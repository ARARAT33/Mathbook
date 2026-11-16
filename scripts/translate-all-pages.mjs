import fs from 'node:fs/promises';
import path from 'node:path';

const OUTPUT_PATH = path.join(process.cwd(), 'lib', 'translated-book.json');
const API_URL = 'http://localhost:3000/api/translate-page';
const SEED_PAGES = new Set([1, 2, 3, 4, 5, 6, 272]);
const TOTAL_PAGES = 272;

function hasExcessiveCyrillic(text) {
  const matches = text.match(/[\u0400-\u04FF]/g);
  return matches ? matches.length > 20 : false;
}

function normalizeCtrl(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\f/g, '\\f')
    .replace(/\x08/g, '\\b')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r')
    .replace(/(\$[^$\n]*)\n(eq|ot|otin)\b/g, '$1\\n$2');
}

function isPageValid(entry) {
  if (!entry || typeof entry.translatedMarkdown !== 'string') return false;
  const md = normalizeCtrl(entry.translatedMarkdown).trim();
  if (md.length < 30) return false;
  if (hasExcessiveCyrillic(md)) return false;
  if (/(?:^|[^\\a-zA-Z])ot\\text|\\not\\text/.test(md)) return false;
  if (/\\boxed\{\\text\{\s*\}/.test(md) || /\\boxed\{\s*\}/.test(md)) return false;
  if (/\$[a-zA-Z]\s*\\neq\s*\\text(?:bf|rm)\{[RNZQ]\}/.test(md)) return false;
  if (/[=<>+\-*/\s]\s\{[a-zA-Z0-9][^}]{0,25}\}/.test(md.replace(/\{[,;.]\}/g, ''))) return false;
  const noCases = md.replace(/\\begin\{cases\}[\s\S]*?\\end\{cases\}/g, '');
  if ((noCases.match(/\\text\{/g) || []).length > 15) return false;
  const noDisp = md.replace(/\$\$[\s\S]*?\$\$/g, '');
  const sd = (noDisp.match(/(?<!\\)\$/g) || []).length;
  if (sd % 2 !== 0) return false;
  return true;
}

async function loadExisting() {
  try {
    const raw = await fs.readFile(OUTPUT_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

let writeQueue = Promise.resolve();
function saveBookState(bookMap) {
  writeQueue = writeQueue.then(async () => {
    const sorted = {};
    for (let p = 1; p <= TOTAL_PAGES; p++) {
      if (bookMap[String(p)]) {
        sorted[String(p)] = bookMap[String(p)];
      }
    }
    const tmpPath = `${OUTPUT_PATH}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(sorted, null, 2), 'utf8');
    await fs.rename(tmpPath, OUTPUT_PATH);
  });
  return writeQueue;
}

async function translateBatch(pageNumbers, thinking = 'minimal') {
  const maxAttempts = 4;
  let lastErr = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180000);
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: pageNumbers, thinking }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();
      if (!res.ok || !Array.isArray(data.pages)) {
        const errMsg = data?.error || `HTTP ${res.status}`;
        if (errMsg.includes('PerDay') || (errMsg.includes('retry in') && errMsg.includes('h'))) {
          const fatal = new Error(`DAILY_QUOTA_EXHAUSTED: ${errMsg}`);
          fatal.isDailyQuota = true;
          throw fatal;
        }
        throw new Error(errMsg);
      }

      const validPages = [];
      for (const item of data.pages) {
        const candidate = {
          pageNumber: item.pageNumber,
          sectionTitle: item.sectionTitle,
          translatedMarkdown: item.translatedMarkdown,
          source: 'gemini',
          updatedAt: new Date().toISOString(),
        };
        if (isPageValid(candidate)) {
          validPages.push(candidate);
        } else {
          console.warn(
            `[warn] Page ${item.pageNumber} failed quality validation, will retry.`
          );
        }
      }

      if (validPages.length === 0) {
        throw new Error(`No valid pages returned for batch [${pageNumbers.join(',')}]`);
      }

      return validPages;
    } catch (err) {
      lastErr = err;
      if (err && err.isDailyQuota) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
      const delay = isRateLimit ? Math.min(35000, 10000 * attempt) : 2500 * attempt;
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastErr || new Error(`Failed batch [${pageNumbers.join(',')}]`);
}

function getMissingOrInvalidPages(bookMap) {
  const missing = [];
  for (let p = 1; p <= TOTAL_PAGES; p++) {
    if (SEED_PAGES.has(p)) continue;
    if (!isPageValid(bookMap[String(p)])) {
      missing.push(p);
    }
  }
  return missing;
}

async function runPass(bookMap, targetPages, batchSize, concurrency, thinking = 'minimal') {
  const batches = [];
  for (let i = 0; i < targetPages.length; i += batchSize) {
    batches.push(targetPages.slice(i, i + batchSize));
  }

  console.log(
    `Starting pass: ${targetPages.length} pages in ${batches.length} batches (batchSize=${batchSize}, concurrency=${concurrency}, thinking=${thinking})...`
  );

  let nextIdx = 0;
  let dailyQuotaHit = null;

  async function worker(workerId) {
    while (!dailyQuotaHit) {
      const idx = nextIdx++;
      if (idx >= batches.length) break;
      const slice = batches[idx];

      try {
        const results = await translateBatch(slice, thinking);
        for (const item of results) {
          bookMap[String(item.pageNumber)] = item;
        }
        await saveBookState(bookMap);
        const remaining = getMissingOrInvalidPages(bookMap).length;
        console.log(
          `[w${workerId}] Batch [${slice[0]}..${slice[slice.length - 1]}] -> +${results.length}/${slice.length} ok (Total valid non-seed: ${265 - remaining}/265)`
        );
      } catch (err) {
        if (err && err.isDailyQuota) {
          dailyQuotaHit = err;
          console.error(`[w${workerId}] DAILY QUOTA HIT:`, err.message.slice(0, 300));
          break;
        }
        console.error(
          `[w${workerId}] Batch [${slice.join(',')}] failed:`,
          err instanceof Error ? err.message.slice(0, 200) : err
        );
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i + 1)));
  await saveBookState(bookMap);
  if (dailyQuotaHit) throw dailyQuotaHit;
}

async function main() {
  const bookMap = await loadExisting();

  // Pass 1: Fast multi-page batches
  let missing = getMissingOrInvalidPages(bookMap);
  if (missing.length > 0) {
    await runPass(bookMap, missing, 8, 5, 'minimal');
  }

  // Pass 2: Smaller low-thinking precision pass for any flagged pages
  missing = getMissingOrInvalidPages(bookMap);
  if (missing.length > 0) {
    await runPass(bookMap, missing, 3, 4, 'low');
  }

  // Pass 3: Single-page low-thinking precision for any stragglers
  missing = getMissingOrInvalidPages(bookMap);
  if (missing.length > 0) {
    await runPass(bookMap, missing, 1, 3, 'low');
  }

  missing = getMissingOrInvalidPages(bookMap);
  console.log(`FINAL STATUS: Missing/invalid non-seed pages = ${missing.length}`, missing);
  if (missing.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
