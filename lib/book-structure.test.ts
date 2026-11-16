import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOTAL_BOOK_PAGES,
  BOOK_SECTIONS,
  validatePageNumber,
  getSectionForPage,
  calculateProgressStats,
  getSectionProgress,
  getMissingPages,
  buildCompiledBookMarkdown,
  getModelBadgeInfo,
  TRANSLATION_MODELS,
  type TranslatedPage,
} from './book-structure';

test('validatePageNumber clamps bounds between 1 and 272', () => {
  assert.equal(validatePageNumber(0), 1);
  assert.equal(validatePageNumber(-12), 1);
  assert.equal(validatePageNumber(1), 1);
  assert.equal(validatePageNumber(44.8), 44);
  assert.equal(validatePageNumber(272), 272);
  assert.equal(validatePageNumber(999), 272);
  assert.equal(validatePageNumber(Number.NaN), 1);
});

test('BOOK_SECTIONS covers all 272 pages contiguously', () => {
  assert.equal(BOOK_SECTIONS[0].startPage, 1);
  assert.equal(BOOK_SECTIONS[BOOK_SECTIONS.length - 1].endPage, TOTAL_BOOK_PAGES);

  for (let p = 1; p <= TOTAL_BOOK_PAGES; p++) {
    const sec = getSectionForPage(p);
    assert.ok(sec.startPage <= p && p <= sec.endPage);
  }
});

test('getSectionForPage maps key pages to expected chapters', () => {
  assert.equal(getSectionForPage(3).id, 'front-matter');
  assert.equal(getSectionForPage(4).code, '§ 1');
  assert.equal(getSectionForPage(44).code, '§ 5');
  assert.equal(getSectionForPage(226).code, 'Պատասխաններ');
  assert.equal(getSectionForPage(272).code, 'Վերջաբան');
});

test('calculateProgressStats and getSectionProgress compute accurate counts', () => {
  const sampleMap: Record<number, TranslatedPage> = {
    1: {
      pageNumber: 1,
      sectionTitle: 'Տիտղոսաթերթ',
      translatedMarkdown: 'Տեքստ $x^2 + 1 = 0$',
      source: 'seed',
      updatedAt: '2026-11-16T00:00:00Z',
    },
    2: {
      pageNumber: 2,
      sectionTitle: 'Բովանդակություն',
      translatedMarkdown: 'Տեքստ',
      source: 'seed',
      updatedAt: '2026-11-16T00:00:00Z',
    },
    3: {
      pageNumber: 3,
      sectionTitle: 'Նախաբան',
      translatedMarkdown: '   ',
      source: 'seed',
      updatedAt: '2026-11-16T00:00:00Z',
    },
  };

  const stats = calculateProgressStats(sampleMap);
  assert.equal(stats.totalPages, 272);
  assert.equal(stats.translatedCount, 2);
  assert.equal(stats.remainingCount, 270);
  assert.equal(stats.percentage, 0.7);

  const frontSec = BOOK_SECTIONS[0];
  const secProgress = getSectionProgress(frontSec, sampleMap);
  assert.equal(secProgress.total, 3);
  assert.equal(secProgress.translated, 2);
  assert.deepEqual(secProgress.missingPages, [3]);

  const missing = getMissingPages(sampleMap);
  assert.equal(missing.length, 270);
  assert.equal(missing[0], 3);
});

test('buildCompiledBookMarkdown preserves LaTeX formulas and page order', () => {
  const sampleMap: Record<number, TranslatedPage> = {
    4: {
      pageNumber: 4,
      sectionTitle: '§ 1',
      translatedMarkdown: 'Արտահայտություն $a^m \\cdot a^n = a^{m+n}$։',
      source: 'seed',
      updatedAt: '2026-11-16T00:00:00Z',
    },
    1: {
      pageNumber: 1,
      sectionTitle: 'Տիտղոսաթերթ',
      translatedMarkdown: 'Խնդրագիրք $8–9$',
      source: 'seed',
      updatedAt: '2026-11-16T00:00:00Z',
    },
  };

  const compiled = buildCompiledBookMarkdown(sampleMap);
  const idx1 = compiled.indexOf('## Էջ 1');
  const idx4 = compiled.indexOf('## Էջ 4');
  assert.ok(idx1 !== -1 && idx4 !== -1 && idx1 < idx4);
  assert.ok(compiled.includes('$a^m \\cdot a^n = a^{m+n}$'));
});

test('getModelBadgeInfo maps all models accurately', () => {
  const g4 = getModelBadgeInfo('gemini-4-hydrogen');
  assert.equal(g4.shortLabel, 'G4 Hydrogen');
  assert.ok(g4.colorClass.includes('indigo'));

  const g3 = getModelBadgeInfo('gemini-3.1-pro-preview');
  assert.equal(g3.shortLabel, 'G3 Pro');
  assert.ok(g3.colorClass.includes('violet'));

  const flash = getModelBadgeInfo('gemini-2.5-flash');
  assert.equal(g4.label, 'Gemini 4 Hydrogen');
  assert.equal(flash.shortLabel, 'G Flash');
  assert.ok(flash.colorClass.includes('amber'));

  const lite = getModelBadgeInfo('gemini-3.1-flash-lite');
  assert.equal(lite.shortLabel, 'Flash Lite');
  assert.ok(lite.colorClass.includes('sky'));

  const seed = getModelBadgeInfo('seed');
  assert.equal(seed.shortLabel, 'Ձեռագիր');

  const edited = getModelBadgeInfo('edited');
  assert.equal(edited.shortLabel, 'Խմբագրված');

  const fallback = getModelBadgeInfo();
  assert.equal(fallback.shortLabel, 'AI');
});

test('TRANSLATION_MODELS contains all 5 model choices in expected order', () => {
  assert.equal(TRANSLATION_MODELS.length, 5);
  assert.equal(TRANSLATION_MODELS[0].id, 'auto');
  assert.equal(TRANSLATION_MODELS[1].id, 'gemini-4-hydrogen');
  assert.equal(TRANSLATION_MODELS[2].id, 'gemini-3.1-pro-preview');
  assert.equal(TRANSLATION_MODELS[3].id, 'gemini-2.5-flash');
  assert.equal(TRANSLATION_MODELS[4].id, 'gemini-3.1-flash-lite');
});

