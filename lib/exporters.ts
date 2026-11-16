import katex from 'katex';
import { marked } from 'marked';
import { PDFDocument, rgb, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  PageBreak,
} from 'docx';
import { TOTAL_BOOK_PAGES, type TranslatedPage } from './book-structure';

const KATEX_MACROS: Record<string, string> = {
  '\\tg': '\\operatorname{tg}',
  '\\ctg': '\\operatorname{ctg}',
  '\\arctg': '\\operatorname{arctg}',
  '\\arcctg': '\\operatorname{arcctg}',
};

function renderLatexWithKatex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex.trim(), {
      displayMode,
      throwOnError: false,
      strict: false,
      macros: KATEX_MACROS,
    });
  } catch {
    return escapeHtml(tex);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Converts Markdown containing $...$ and $$...$$ math blocks into clean HTML
 * with KaTeX-rendered mathematical typography.
 */
export function renderMarkdownWithMathToHtml(markdown: string): string {
  const placeholders: string[] = [];

  // Replace display math $$...$$ first
  let protectedMd = markdown.replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex: string) => {
    const id = `@@MATH_BLOCK_${placeholders.length}@@`;
    placeholders.push(`<div class="math-display">${renderLatexWithKatex(tex, true)}</div>`);
    return `\n\n${id}\n\n`;
  });

  // Replace inline math $...$
  protectedMd = protectedMd.replace(/(?<!\$)\$(?!\$)([^\n$]+?)(?<!\\)\$/g, (_m, tex: string) => {
    const id = `@@MATH_INLINE_${placeholders.length}@@`;
    placeholders.push(renderLatexWithKatex(tex, false));
    return id;
  });

  let html = marked.parse(protectedMd, { gfm: true, breaks: false }) as string;

  for (let i = 0; i < placeholders.length; i++) {
    const blockToken = `@@MATH_BLOCK_${i}@@`;
    const inlineToken = `@@MATH_INLINE_${i}@@`;
    if (html.includes(blockToken)) {
      html = html.replace(`<p>${blockToken}</p>`, placeholders[i]).replace(blockToken, placeholders[i]);
    }
    if (html.includes(inlineToken)) {
      html = html.replace(inlineToken, placeholders[i]);
    }
  }

  return html;
}

export function buildFullBookHtmlDocument(
  pagesMap: Record<number, TranslatedPage>
): string {
  const sections: string[] = [];

  for (let p = 1; p <= TOTAL_BOOK_PAGES; p++) {
    const entry = pagesMap[p];
    if (!entry || !entry.translatedMarkdown?.trim()) continue;
    const bodyHtml = renderMarkdownWithMathToHtml(entry.translatedMarkdown);
    sections.push(`
      <section class="book-page" id="page-${p}">
        <div class="page-meta">
          <span class="page-num">Էջ ${p}</span>
          <span class="page-sec">${escapeHtml(entry.sectionTitle)}</span>
        </div>
        <div class="page-content">
          ${bodyHtml}
        </div>
      </section>
    `);
  }

  return `<!DOCTYPE html>
<html lang="hy">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Հանրահաշվի խնդրագիրք 8–9 դաս. (Մ. Լ. Գալիցկի և ուրիշ.) — Հայերեն թարգմանություն</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Armenian:wght@400;500;600;700&family=Noto+Serif+Armenian:wght@600;700&display=swap');
    body {
      font-family: 'Noto Sans Armenian', 'Sylfaen', system-ui, sans-serif;
      max-width: 880px;
      margin: 40px auto;
      padding: 0 24px 64px;
      color: #0f172a;
      background: #f8fafc;
      line-height: 1.72;
    }
    .doc-cover {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 32px;
      margin-bottom: 28px;
    }
    .doc-cover h1 {
      font-family: 'Noto Serif Armenian', Georgia, serif;
      font-size: 26px;
      margin: 0 0 8px;
    }
    .doc-cover p {
      color: #475569;
      margin: 0;
      font-size: 14px;
    }
    .book-page {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 32px 36px;
      margin-bottom: 24px;
      page-break-after: always;
    }
    .page-meta {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 10px;
      margin-bottom: 18px;
      font-size: 12px;
    }
    .page-num {
      font-weight: 700;
      color: #0284c7;
    }
    .page-sec {
      color: #475569;
      font-weight: 500;
    }
    .page-content h1, .page-content h2, .page-content h3 {
      font-family: 'Noto Serif Armenian', Georgia, serif;
      color: #0f172a;
    }
    .page-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 14px;
    }
    .page-content th, .page-content td {
      border-bottom: 1px solid #e2e8f0;
      padding: 6px 8px;
      text-align: left;
    }
    .math-display {
      margin: 12px 0;
      overflow-x: auto;
      text-align: center;
    }
    @media print {
      body { background: #ffffff; margin: 0; padding: 0; max-width: none; }
      .doc-cover, .book-page { border: none; border-radius: 0; padding: 12mm 16mm; margin: 0; }
    }
  </style>
</head>
<body>
  <header class="doc-cover">
    <h1>Մ. Լ. Գալիցկի, Ա. Մ. Գոլդման, Լ. Ի. Զվավիչ — ՀԱՆՐԱՀԱՇՎԻ ԽՆԴՐԱԳԻՐՔ (8–9 դաս.)</h1>
    <p>Ուսումնական ձեռնարկ մաթեմատիկայի խորացված ուսումնասիրությամբ 8–9 դասարանների համար · Ամբողջական հայերեն թարգմանություն (${sections.length} էջ)</p>
  </header>
  ${sections.join('\n')}
</body>
</html>`;
}

/**
 * Formats LaTeX notation cleanly into readable Unicode mathematical notation for Word (.docx)
 * while preserving every mathematical value, expression, and equation structure.
 */
export function formatLatexForWord(text: string): string {
  return text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex: string) => `\n${latexToReadableUnicode(tex)}\n`)
    .replace(/(?<!\$)\$(?!\$)([^\n$]+?)(?<!\\)\$/g, (_m, tex: string) => latexToReadableUnicode(tex));
}

function latexToReadableUnicode(tex: string): string {
  let out = tex.trim();

  // Unwrap display/wrapper commands
  out = out.replace(/\\(text|textbf|textrm|mathbf|mathrm|mathbb)\{([^{}]*)\}/g, '$2');
  out = out.replace(/\\operatorname\{([^{}]*)\}/g, '$1');
  out = out.replace(/\\(displaystyle|textstyle|limits|nolimits)\b/g, '');
  out = out.replace(/\\left\s*/g, '').replace(/\\right\s*/g, '');
  out = out.replace(/\\(big|Big|bigg|Bigg)[lr]?\s*/g, '');
  out = out.replace(/\\quad/g, '  ').replace(/\\qquad/g, '    ').replace(/\\[,;:!]/g, ' ');
  out = out.replace(/\\overline\{([^{}]+)\}/g, '$1');
  out = out.replace(/\\underline\{([^{}]+)\}/g, '$1');

  // Fractions: \frac{a}{b} -> (a)/(b) or a/b for simple tokens
  for (let i = 0; i < 4; i++) {
    out = out.replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, (_m, num: string, den: string) => {
      const simpleNum = /^[a-zA-Z0-9]+$/.test(num.trim());
      const simpleDen = /^[a-zA-Z0-9]+$/.test(den.trim());
      const n = simpleNum ? num.trim() : `(${num.trim()})`;
      const d = simpleDen ? den.trim() : `(${den.trim()})`;
      return `${n}/${d}`;
    });
  }

  // Roots: \sqrt[n]{x} -> [n]√(x), \sqrt{x} -> √(x)
  for (let i = 0; i < 3; i++) {
    out = out.replace(/\\sqrt\[([^\]]+)\]\{([^{}]+)\}/g, '[$1]√($2)');
    out = out.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');
  }

  // Common math operators & symbols (order longer matches first!)
  const replacements: [RegExp, string][] = [
    [/\\leqslant|\\leq|\\le(?![a-z])/g, '≤'],
    [/\\geqslant|\\geq|\\ge(?![a-z])/g, '≥'],
    [/\\neq|\\ne(?![a-z])/g, '≠'],
    [/\\approx/g, '≈'],
    [/\\equiv/g, '≡'],
    [/\\pm/g, '±'],
    [/\\mp/g, '∓'],
    [/\\cdot/g, '·'],
    [/\\times/g, '×'],
    [/\\div/g, '÷'],
    [/\\infty/g, '∞'],
    [/\\dots|\\cdots|\\ldots/g, '…'],
    [/\\notin/g, '∉'],
    [/\\in(?![a-z])/g, '∈'],
    [/\\subset/g, '⊂'],
    [/\\cup/g, '∪'],
    [/\\cap/g, '∩'],
    [/\\emptyset/g, '∅'],
    [/\\Rightarrow/g, '⇒'],
    [/\\Leftrightarrow/g, '⇔'],
    [/\\to(?![a-z])|\\rightarrow/g, '→'],
    [/\\alpha/g, 'α'],
    [/\\beta/g, 'β'],
    [/\\gamma/g, 'γ'],
    [/\\delta/g, 'δ'],
    [/\\varepsilon|\\epsilon/g, 'ε'],
    [/\\varphi|\\phi/g, 'φ'],
    [/\\pi/g, 'π'],
    [/\\degree|\^\\circ/g, '°'],
    [/\\(arctg|arcctg|arcsin|arccos|ctg|tg|sin|cos|log|lg|ln|lim|max|min)\b/g, '$1'],
    [/\\begin\{cases\}/g, '{ '],
    [/\\end\{cases\}/g, ' }'],
    [/\\\{/g, '{'],
    [/\\\}/g, '}'],
    [/\\mid(?![a-z])/g, '|'],
    [/\\\\/g, '; '],
    [/\{,\}/g, ','],
  ];

  for (const [re, sym] of replacements) {
    out = out.replace(re, sym);
  }

  // Simple superscripts like ^2, ^3
  out = out
    .replace(/\^2(?![0-9a-zA-Z])/g, '²')
    .replace(/\^3(?![0-9a-zA-Z])/g, '³')
    .replace(/\^\{([^{}]+)\}/g, '^($1)')
    .replace(/_\{([^{}]+)\}/g, '_$1');

  return out.replace(/\s+/g, ' ').trim();
}

function parseRunsWithBoldAndItalic(line: string): TextRun[] {
  const formatted = formatLatexForWord(line);
  const runs: TextRun[] = [];
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(formatted)) !== null) {
    if (match.index > lastIndex) {
      runs.push(
        new TextRun({
          text: formatted.slice(lastIndex, match.index),
          font: 'Sylfaen',
          size: 22,
        })
      );
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      runs.push(
        new TextRun({
          text: token.slice(2, -2),
          bold: true,
          font: 'Sylfaen',
          size: 22,
        })
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      runs.push(
        new TextRun({
          text: token.slice(1, -1),
          italics: true,
          font: 'Sylfaen',
          size: 22,
        })
      );
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < formatted.length) {
    runs.push(
      new TextRun({
        text: formatted.slice(lastIndex),
        font: 'Sylfaen',
        size: 22,
      })
    );
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text: formatted, font: 'Sylfaen', size: 22 }));
  }
  return runs;
}

export async function buildFullBookDocxBlob(
  pagesMap: Record<number, TranslatedPage>
): Promise<Blob> {
  const children: Paragraph[] = [
    new Paragraph({
      text: 'Մ. Լ. Գալիցկի, Ա. Մ. Գոլդման, Լ. Ի. Զվավիչ',
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      text: 'ՀԱՆՐԱՀԱՇՎԻ ԽՆԴՐԱԳԻՐՔ (8–9 ԴԱՍԱՐԱՆՆԵՐ)',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
    }),
    new Paragraph({
      text: 'Ուսումնական ձեռնարկ մաթեմատիկայի խորացված ուսումնասիրությամբ 8–9 դասարանների համար — Ամբողջական հայերեն թարգմանություն',
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
    }),
  ];

  let addedPages = 0;
  for (let p = 1; p <= TOTAL_BOOK_PAGES; p++) {
    const entry = pagesMap[p];
    if (!entry || !entry.translatedMarkdown?.trim()) continue;

    if (addedPages > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
    addedPages++;

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Էջ ${p} · ${entry.sectionTitle}`,
            bold: true,
            color: '0284C7',
            font: 'Sylfaen',
            size: 18,
          }),
        ],
        spacing: { before: 120, after: 140 },
      })
    );

    const lines = entry.translatedMarkdown.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.startsWith('# ')) {
        children.push(
          new Paragraph({
            text: formatLatexForWord(line.slice(2)),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 180, after: 120 },
          })
        );
      } else if (line.startsWith('## ')) {
        children.push(
          new Paragraph({
            text: formatLatexForWord(line.slice(3)),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 160, after: 100 },
          })
        );
      } else if (line.startsWith('### ')) {
        children.push(
          new Paragraph({
            text: formatLatexForWord(line.slice(4)),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 140, after: 80 },
          })
        );
      } else if (/^\|[\s-:|]+\|$/.test(line)) {
        // Skip markdown table separator line
        continue;
      } else if (line.startsWith('|') && line.endsWith('|')) {
        const cleanRow = line
          .slice(1, -1)
          .split('|')
          .map((c) => formatLatexForWord(c.trim()))
          .join('   —   ');
        children.push(
          new Paragraph({
            children: [new TextRun({ text: cleanRow, font: 'Sylfaen', size: 20 })],
            spacing: { after: 60 },
          })
        );
      } else {
        children.push(
          new Paragraph({
            children: parseRunsWithBoldAndItalic(line),
            spacing: { after: 100 },
          })
        );
      }
    }
  }

  const doc = new Document({
    creator: 'Հանրահաշիվ 8–9 Հայերեն Թարգմանություն',
    title: 'Հանրահաշվի խնդրագիրք 8–9 դաս. (Գալիցկի)',
    sections: [{ children }],
  });

  return Packer.toBlob(doc);
}

export interface PdfFontBytes {
  regular: Uint8Array;
  bold: Uint8Array;
}

const fontCharSupportCache = new WeakMap<PDFFont, Map<string, boolean>>();

function sanitizePdfText(text: string, font: PDFFont): string {
  const normalized = text
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r/g, '');
  let charCache = fontCharSupportCache.get(font);
  if (!charCache) {
    charCache = new Map<string, boolean>();
    fontCharSupportCache.set(font, charCache);
  }
  let safe = '';
  for (const ch of normalized) {
    let ok = charCache.get(ch);
    if (ok === undefined) {
      try {
        font.encodeText(ch);
        ok = true;
      } catch {
        ok = false;
      }
      charCache.set(ch, ok);
    }
    safe += ok ? ch : ' ';
  }
  return safe;
}

function wrapTextToWidth(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const clean = sanitizePdfText(text, font);
  if (!clean.trim()) return [];
  const words = clean.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
        current = '';
      }
      if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
        current = word;
      } else {
        // Hard-break long unspaced formula
        let chunk = '';
        for (const ch of word) {
          const nextChunk = chunk + ch;
          if (font.widthOfTextAtSize(nextChunk, fontSize) <= maxWidth) {
            chunk = nextChunk;
          } else {
            if (chunk) lines.push(chunk);
            chunk = ch;
          }
        }
        current = chunk;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function stripMarkdownStyling(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

export async function buildFullBookPdfBytes(
  pagesMap: Record<number, TranslatedPage>,
  providedFonts?: PdfFontBytes
): Promise<Uint8Array> {
  let fontsData = providedFonts;
  if (!fontsData) {
    const [regRes, boldRes] = await Promise.all([
      fetch('/fonts/DejaVuSans.ttf'),
      fetch('/fonts/DejaVuSans-Bold.ttf'),
    ]);
    if (!regRes.ok || !boldRes.ok) {
      throw new Error('Չհաջողվեց բեռնել հայկական PDF տառատեսակները։');
    }
    fontsData = {
      regular: new Uint8Array(await regRes.arrayBuffer()),
      bold: new Uint8Array(await boldRes.arrayBuffer()),
    };
  }

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const regularFont = await pdfDoc.embedFont(fontsData.regular);
  const boldFont = await pdfDoc.embedFont(fontsData.bold);

  const pageWidth = 595.28; // A4 portrait width
  const pageHeight = 841.89; // A4 portrait height
  const marginX = 46;
  const marginTop = 52;
  const marginBottom = 48;
  const maxWidth = pageWidth - marginX * 2;

  let currentPdfPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - marginTop;
  let pdfPageNum = 1;

  const drawFooter = (pageObj: typeof currentPdfPage, num: number) => {
    const label = `${num}`;
    const w = regularFont.widthOfTextAtSize(label, 9);
    pageObj.drawText(label, {
      x: (pageWidth - w) / 2,
      y: 24,
      size: 9,
      font: regularFont,
      color: rgb(0.45, 0.5, 0.58),
    });
  };

  const ensureSpace = (neededHeight: number) => {
    if (cursorY - neededHeight < marginBottom) {
      drawFooter(currentPdfPage, pdfPageNum);
      currentPdfPage = pdfDoc.addPage([pageWidth, pageHeight]);
      pdfPageNum++;
      cursorY = pageHeight - marginTop;
    }
  };

  // Cover header
  const coverTitle = 'Մ. Լ. Գալիցկի, Ա. Մ. Գոլդման, Լ. Ի. Զվավիչ';
  const coverMain = 'ՀԱՆՐԱՀԱՇՎԻ ԽՆԴՐԱԳԻՐՔ (8–9 ԴԱՍԱՐԱՆՆԵՐ)';
  const coverSub =
    'Ուսումնական ձեռնարկ մաթեմատիկայի խորացված ուսումնասիրությամբ 8–9 դասարանների համար · Ամբողջական հայերեն թարգմանություն';

  for (const line of wrapTextToWidth(coverTitle, regularFont, 11, maxWidth)) {
    currentPdfPage.drawText(line, {
      x: marginX,
      y: cursorY,
      size: 11,
      font: regularFont,
      color: rgb(0.3, 0.36, 0.45),
    });
    cursorY -= 16;
  }
  cursorY -= 4;
  for (const line of wrapTextToWidth(coverMain, boldFont, 16, maxWidth)) {
    currentPdfPage.drawText(line, {
      x: marginX,
      y: cursorY,
      size: 16,
      font: boldFont,
      color: rgb(0.06, 0.09, 0.16),
    });
    cursorY -= 22;
  }
  cursorY -= 4;
  for (const line of wrapTextToWidth(coverSub, regularFont, 10, maxWidth)) {
    currentPdfPage.drawText(line, {
      x: marginX,
      y: cursorY,
      size: 10,
      font: regularFont,
      color: rgb(0.35, 0.42, 0.52),
    });
    cursorY -= 14;
  }
  cursorY -= 14;

  let renderedBookPages = 0;
  for (let p = 1; p <= TOTAL_BOOK_PAGES; p++) {
    const entry = pagesMap[p];
    if (!entry || !entry.translatedMarkdown?.trim()) continue;

    if (renderedBookPages > 0) {
      drawFooter(currentPdfPage, pdfPageNum);
      currentPdfPage = pdfDoc.addPage([pageWidth, pageHeight]);
      pdfPageNum++;
      cursorY = pageHeight - marginTop;
    }
    renderedBookPages++;

    const headerLabel = sanitizePdfText(`Էջ ${p}  ·  ${entry.sectionTitle}`, boldFont);
    ensureSpace(24);
    currentPdfPage.drawText(headerLabel, {
      x: marginX,
      y: cursorY,
      size: 9.5,
      font: boldFont,
      color: rgb(0.01, 0.52, 0.78),
    });
    cursorY -= 8;
    currentPdfPage.drawLine({
      start: { x: marginX, y: cursorY },
      end: { x: pageWidth - marginX, y: cursorY },
      thickness: 0.6,
      color: rgb(0.85, 0.88, 0.92),
    });
    cursorY -= 16;

    const lines = entry.translatedMarkdown.split('\n');
    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        cursorY -= 5;
        continue;
      }
      if (/^\|[\s-:|]+\|$/.test(trimmed)) {
        continue;
      }

      let font = regularFont;
      let fontSize = 10;
      let lineHeight = 14.5;
      let textContent = trimmed;
      let extraAfter = 3;

      if (trimmed.startsWith('# ')) {
        font = boldFont;
        fontSize = 13.5;
        lineHeight = 18;
        textContent = trimmed.slice(2);
        extraAfter = 6;
      } else if (trimmed.startsWith('## ')) {
        font = boldFont;
        fontSize = 11.5;
        lineHeight = 16;
        textContent = trimmed.slice(3);
        extraAfter = 5;
      } else if (trimmed.startsWith('### ')) {
        font = boldFont;
        fontSize = 10.5;
        lineHeight = 15;
        textContent = trimmed.slice(4);
        extraAfter = 4;
      } else if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        textContent = trimmed
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim())
          .join('  —  ');
      }

      const formatted = stripMarkdownStyling(formatLatexForWord(textContent));
      const wrapped = wrapTextToWidth(formatted, font, fontSize, maxWidth);

      for (const wLine of wrapped) {
        ensureSpace(lineHeight + 2);
        currentPdfPage.drawText(wLine, {
          x: marginX,
          y: cursorY,
          size: fontSize,
          font,
          color: rgb(0.06, 0.09, 0.16),
        });
        cursorY -= lineHeight;
      }
      cursorY -= extraAfter;
    }
  }

  drawFooter(currentPdfPage, pdfPageNum);
  return pdfDoc.save();
}

export async function buildFullBookPdfBlob(
  pagesMap: Record<number, TranslatedPage>,
  providedFonts?: PdfFontBytes
): Promise<Blob> {
  const bytes = await buildFullBookPdfBytes(pagesMap, providedFonts);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: 'application/pdf' });
}
