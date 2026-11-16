import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderMarkdownWithMathToHtml,
  buildFullBookHtmlDocument,
  formatLatexForWord,
  buildFullBookDocxBlob,
  buildFullBookPdfBytes,
} from './exporters';
import type { TranslatedPage } from './book-structure';

test('renderMarkdownWithMathToHtml converts LaTeX into KaTeX HTML spans', () => {
  const html = renderMarkdownWithMathToHtml('Լուծեք $x^2 - 4 = 0$ հավասարումը։');
  assert.ok(html.includes('katex'));
  assert.ok(html.includes('Լուծեք'));
  assert.ok(!html.includes('$x^2 - 4 = 0$'));
});

test('buildFullBookHtmlDocument renders multi-page self-contained HTML with KaTeX CSS', () => {
  const pages: Record<number, TranslatedPage> = {
    1: {
      pageNumber: 1,
      sectionTitle: 'Տիտղոսաթերթ',
      translatedMarkdown: '# ՀԱՆՐԱՀԱՇԻՎ\n\nԲանաձև՝ $\\frac{a}{b}$',
      source: 'seed',
      updatedAt: '2026-11-16T00:00:00Z',
    },
  };
  const html = buildFullBookHtmlDocument(pages);
  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('katex.min.css'));
  assert.ok(html.includes('Էջ 1'));
  assert.ok(html.includes('katex'));
});

test('formatLatexForWord preserves numbers/equations in clean readable Unicode', () => {
  const out = formatLatexForWord(
    'Հաշվել $\\frac{a}{b} \\neq 0$, $\\sqrt{x} \\geqslant 2$, $y \\leqslant 5$ և $\\sin\\alpha + \\operatorname{tg}\\beta$'
  );
  assert.ok(out.includes('a/b ≠ 0'));
  assert.ok(out.includes('√(x) ≥ 2'));
  assert.ok(out.includes('y ≤ 5'));
  assert.ok(out.includes('sinα + tgβ'));
});

test('buildFullBookDocxBlob generates a non-empty valid ZIP/DOCX blob', async () => {
  const pages: Record<number, TranslatedPage> = {
    1: {
      pageNumber: 1,
      sectionTitle: 'Տիտղոսաթերթ',
      translatedMarkdown: '# ՀԱՆՐԱՀԱՇԻՎ\n\nՀավասարում՝ $x^2 + 2x + 1 = 0$',
      source: 'seed',
      updatedAt: '2026-11-16T00:00:00Z',
    },
  };
  const blob = await buildFullBookDocxBlob(pages);
  assert.ok(blob.size > 1000);
  const buf = new Uint8Array(await blob.arrayBuffer());
  // DOCX is a ZIP archive starting with 'PK' (0x50, 0x4B)
  assert.equal(buf[0], 0x50);
  assert.equal(buf[1], 0x4b);
});

test('buildFullBookPdfBytes generates a valid PDF with embedded Armenian and Math UTF-8 fonts', async () => {
  const regular = fs.readFileSync(path.join(process.cwd(), 'public/fonts/DejaVuSans.ttf'));
  const bold = fs.readFileSync(path.join(process.cwd(), 'public/fonts/DejaVuSans-Bold.ttf'));
  const pages: Record<number, TranslatedPage> = {
    1: {
      pageNumber: 1,
      sectionTitle: '§ 1. Կրկնություն',
      translatedMarkdown:
        '# ՀԱՆՐԱՀԱՇԻՎ\n\nԱպացուցել, որ $\\frac{a}{b} \\neq 0$ և $\\sqrt{x^2} \\geq 0$։ Հաշվել $\\pi \\approx 3{,}14$։',
      source: 'seed',
      updatedAt: '2026-11-16T00:00:00Z',
    },
  };
  const pdfBytes = await buildFullBookPdfBytes(pages, {
    regular: new Uint8Array(regular),
    bold: new Uint8Array(bold),
  });
  assert.ok(pdfBytes.byteLength > 5000);
  const header = String.fromCharCode(...pdfBytes.slice(0, 5));
  assert.equal(header, '%PDF-');
});
