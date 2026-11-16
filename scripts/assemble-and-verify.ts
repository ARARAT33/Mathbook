import fs from 'node:fs/promises';
import path from 'node:path';
import { SEED_TRANSLATIONS } from '../lib/seed-translations';
import { TOTAL_BOOK_PAGES, type TranslatedPage } from '../lib/book-structure';

const CYRILLIC_ENUM_MAP: Record<string, string> = {
  а: 'ա',
  б: 'բ',
  в: 'գ',
  г: 'դ',
  д: 'ե',
  е: 'զ',
  ж: 'է',
  з: 'ը',
  и: 'թ',
  к: 'ժ',
  л: 'ի',
  м: 'լ',
  н: 'ն',
};

function repairJsonEscapedLatex(md: string): string {
  let out = md
    .replace(/\r\n/g, '\n')
    .replace(/\f/g, '\\f')
    .replace(/\x08/g, '\\b')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r');

  out = out.replace(/(\$[^$\n]*)\n(eq|ot|otin)\b/g, '$1\\n$2');
  return out;
}

function stripAccidentalTextOutsideMath(md: string): string {
  const parts = md.split(/(\$\$[\s\S]*?\$\$|(?<!\\)\$[^$\n]+?(?<!\\)\$)/g);
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = parts[i]
      .replace(/\\text\{(Լուծում|Ցուցում|Պատասխան)([։.:]*)\}/g, '**$1$2**')
      .replace(/\bРис\.\s*(\d+)/g, 'Նկ. $1');
  }
  return parts.join('');
}

function normalizeEnumeratorsAndAbbreviations(md: string): string {
  let out = md.replace(
    /(^|[\s;,($])([абвгдежзиклмн])\)(?=\s|\$|[0-9a-zA-Z(\\-])/gm,
    (full, prefix: string, letter: string) => {
      const mapped = CYRILLIC_ENUM_MAP[letter];
      return mapped ? `${prefix}${mapped})` : full;
    }
  );

  out = out
    .replace(/\bНОД\b/g, 'ԱԸԲ')
    .replace(/\bНОК\b/g, 'ԱԸԲազմ');
  return out;
}

function fixKnownFormulaTypos(pageNumber: number, md: string): string {
  let out = md;
  if (pageNumber === 59) {
    out = out
      .replace(/\$c\s*\\neq\s*\\textbf\{R\}\$/g, '$c \\in \\mathbf{R}$')
      .replace(/\$n\s*\\neq\s*\\textbf\{N\}\$/g, '$n \\in \\mathbf{N}$');
  }
  if (pageNumber === 105) {
    out = out.replace(
      /(բ\)\s*\$y=\\frac\{x\^2-3x\+2\}\{\|x-1\|\}\+\\frac\{x\^2\+3x\+2\}\{\|x\+1\|\}\.)(?!\$)/,
      'բ) $y=\\frac{x^2-3x+2}{|x-1|}+\\frac{x^2+3x+2}{|x+1|}$.'
    );
  }
  return out;
}

async function main() {
  const rawJson = await fs.readFile(path.join(process.cwd(), 'lib', 'translated-book.json'), 'utf8');
  const translated = JSON.parse(rawJson) as Record<string, TranslatedPage>;

  const merged: Record<string, TranslatedPage> = {};
  const missing: number[] = [];
  const cyrillicWarnings: Array<{ page: number; count: number; samples: string[] }> = [];
  const shortPages: Array<{ page: number; length: number; preview: string }> = [];
  const unbalancedMath: Array<{ page: number; singleDollarCount: number }> = [];
  const leakedLatexWarnings: Array<{ page: number; samples: string[] }> = [];
  const corruptSymbolWarnings: Array<{ page: number; issue: string }> = [];

  for (let p = 1; p <= TOTAL_BOOK_PAGES; p++) {
    const entry = SEED_TRANSLATIONS[p] ?? translated[String(p)];
    if (!entry || !entry.translatedMarkdown?.trim()) {
      missing.push(p);
      continue;
    }

    let md = repairJsonEscapedLatex(entry.translatedMarkdown.trim());
    md = stripAccidentalTextOutsideMath(md);
    md = normalizeEnumeratorsAndAbbreviations(md);
    md = fixKnownFormulaTypos(p, md);

    const cyrMatches = md.match(/[\u0400-\u04FF]/g) || [];
    if (cyrMatches.length > 0) {
      const snippets = md.match(/.{0,15}[\u0400-\u04FF]+.{0,15}/g) || [];
      cyrillicWarnings.push({
        page: p,
        count: cyrMatches.length,
        samples: snippets.slice(0, 4),
      });
    }

    if (md.length < 150) {
      shortPages.push({
        page: p,
        length: md.length,
        preview: md.replace(/\n/g, ' '),
      });
    }

    const withoutDisplay = md.replace(/\$\$[\s\S]*?\$\$/g, '');
    const singleDollars = withoutDisplay.match(/(?<!\\)\$/g) || [];
    if (singleDollars.length % 2 !== 0) {
      unbalancedMath.push({
        page: p,
        singleDollarCount: singleDollars.length,
      });
    }

    if (/(?:^|[^\\a-zA-Z])ot\\text|\\not\\text|\\boxed\{\\text\{\s*\}/.test(md)) {
      corruptSymbolWarnings.push({ page: p, issue: 'otText/boxedSqrt' });
    }

    const outside = md
      .replace(/\$\$[\s\S]*?\$\$/g, ' ')
      .replace(/(?<!\\)\$[^$\n]+?(?<!\\)\$/g, ' ');
    if (/\\(?:text|frac|sqrt|cdot|pm|neq|leqslant|geqslant|in|begin|end)\b/.test(outside)) {
      const cmds = outside.match(/\\[a-zA-Z]+(?:\{[^}\n]{0,30}\})?/g) || [];
      leakedLatexWarnings.push({ page: p, samples: cmds.slice(0, 4) });
    }

    merged[String(p)] = {
      pageNumber: p,
      sectionTitle: entry.sectionTitle,
      translatedMarkdown: md,
      source: SEED_TRANSLATIONS[p] ? 'seed' : 'gemini',
      model: SEED_TRANSLATIONS[p] ? 'seed' : (entry.model || 'gemini-3.1-flash-lite'),
      updatedAt: entry.updatedAt || new Date().toISOString(),
    };
  }

  console.log(`Total assembled pages: ${Object.keys(merged).length} / ${TOTAL_BOOK_PAGES}`);
  console.log(`Missing pages (${missing.length}):`, missing);
  console.log(`Cyrillic warnings (${cyrillicWarnings.length}):`, JSON.stringify(cyrillicWarnings, null, 2));
  console.log(`Unbalanced $ math (${unbalancedMath.length}):`, unbalancedMath);
  console.log(`Corrupt symbol warnings (${corruptSymbolWarnings.length}):`, corruptSymbolWarnings);
  console.log(`Leaked LaTeX outside math (${leakedLatexWarnings.length}):`, JSON.stringify(leakedLatexWarnings));
  console.log(`Short pages <150 chars (${shortPages.length}):`, shortPages);

  if (missing.length === 0) {
    const outPath = path.join(process.cwd(), 'public', 'translated-book-272.json');
    await fs.writeFile(outPath, JSON.stringify(merged), 'utf8');
    const stat = await fs.stat(outPath);
    console.log(`Wrote complete 272-page book to public/translated-book-272.json (${(stat.size / 1024).toFixed(1)} KB)`);
  } else {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
