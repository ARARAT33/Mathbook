export const TOTAL_BOOK_PAGES = 272;

export interface BookSection {
  id: string;
  code: string;
  titleHy: string;
  titleRu: string;
  startPage: number;
  endPage: number;
  subsections?: { titleHy: string; page: number }[];
}

export interface TranslatedPage {
  pageNumber: number;
  sectionTitle: string;
  translatedMarkdown: string;
  source: 'seed' | 'gemini' | 'edited';
  updatedAt: string;
}

export interface ProgressStats {
  totalPages: number;
  translatedCount: number;
  remainingCount: number;
  percentage: number;
}

export const BOOK_SECTIONS: BookSection[] = [
  {
    id: 'front-matter',
    code: 'Ներածական',
    titleHy: 'Տիտղոսաթերթ, Բովանդակություն և Նախաբան',
    titleRu: 'Титульный лист, Оглавление и Предисловие',
    startPage: 1,
    endPage: 3,
    subsections: [
      { titleHy: 'Տիտղոսաթերթ և Բովանդակություն (մաս 1)', page: 1 },
      { titleHy: 'Բովանդակություն (մաս 2)', page: 2 },
      { titleHy: 'Նախաբան', page: 3 },
    ],
  },
  {
    id: 'sec-1',
    code: '§ 1',
    titleHy: '7-րդ դասարանի հանրահաշվի դասընթացի կրկնություն և խորացում',
    titleRu: 'Повторение и углубление курса алгебры 7 класса',
    startPage: 4,
    endPage: 11,
  },
  {
    id: 'sec-2',
    code: '§ 2',
    titleHy: 'Ռացիոնալ կոտորակներ',
    titleRu: 'Рациональные дроби',
    startPage: 11,
    endPage: 19,
    subsections: [
      { titleHy: 'Տեսական նյութ և օրինակներ', page: 11 },
      { titleHy: 'Ամբողջ արտահայտություններ', page: 13 },
      { titleHy: 'Կոտորակային արտահայտություններ', page: 15 },
    ],
  },
  {
    id: 'sec-3',
    code: '§ 3',
    titleHy: 'Ամբողջ թվերի բաժանելիություն',
    titleRu: 'Делимость целых чисел',
    startPage: 20,
    endPage: 30,
    subsections: [
      { titleHy: 'Տեսական նյութ և օրինակներ', page: 20 },
      { titleHy: 'Թվերի բաժանելիություն։ Գումարի և արտադրյալի բաժանելիություն', page: 22 },
      { titleHy: 'Մնացորդով բաժանման թեորեմը', page: 23 },
      { titleHy: 'Փոխադարձաբար պարզ թվեր։ ԱԸԲ և ԱԸԲազմապատիկ', page: 25 },
      { titleHy: 'Բաժանելիության հայտանիշներ և վերլուծություն', page: 27 },
      { titleHy: 'Հավասարումներ ամբողջ թվերով', page: 28 },
      { titleHy: 'Տարբեր խնդիրներ', page: 29 },
    ],
  },
  {
    id: 'sec-4',
    code: '§ 4',
    titleHy: 'Քառակուսի արմատներ',
    titleRu: 'Квадратные корни',
    startPage: 30,
    endPage: 44,
    subsections: [
      { titleHy: 'Թվաբանական քառակուսի արմատ', page: 30 },
      { titleHy: 'Իռացիոնալ թվեր', page: 34 },
      { titleHy: '$y = \\sqrt{x}$ ֆունկցիան և նրա գրաֆիկը', page: 36 },
      { titleHy: 'Արտադրյալի և կոտորակի քառակուսի արմատ', page: 37 },
      { titleHy: 'Արմատների գումարում, հանում, բազմապատկում և բաժանում', page: 38 },
      { titleHy: 'Վարժություններ արմատների հետ բոլոր գործողությունների վերաբերյալ', page: 42 },
    ],
  },
  {
    id: 'sec-5',
    code: '§ 5',
    titleHy: 'Քառակուսային հավասարումներ',
    titleRu: 'Квадратные уравнения',
    startPage: 44,
    endPage: 58,
    subsections: [
      { titleHy: 'Տեսական նյութ և Վիետի թեորեմ', page: 44 },
      { titleHy: 'Թերի քառակուսային հավասարումներ', page: 46 },
      { titleHy: 'Լրիվ քառակուսային հավասարումներ', page: 47 },
      { titleHy: 'Կոտորակային ռացիոնալ հավասարումներ', page: 51 },
      { titleHy: 'Քառակուսայինի բերվող հավասարումներ', page: 52 },
      { titleHy: 'Վիետի թեորեմ', page: 53 },
      { titleHy: 'Քառակուսային հավասարման հետազոտում', page: 55 },
      { titleHy: 'Քառակուսային հավասարումների կազմման խնդիրներ', page: 56 },
    ],
  },
  {
    id: 'sec-6',
    code: '§ 6',
    titleHy: 'Անհավասարումներ',
    titleRu: 'Неравенства',
    startPage: 59,
    endPage: 81,
    subsections: [
      { titleHy: 'Թվային անհավասարումներ և նրանց հատկությունները', page: 59 },
      { titleHy: 'Մեկ փոփոխականով անհավասարումներ և նրանց համակարգերը', page: 70 },
    ],
  },
  {
    id: 'sec-7',
    code: '§ 7',
    titleHy: 'Ամբողջ ցուցիչով աստիճան',
    titleRu: 'Степень с целым показателем',
    startPage: 82,
    endPage: 87,
  },
  {
    id: 'sec-8',
    code: '§ 8',
    titleHy: 'Ֆունկցիա',
    titleRu: 'Функция',
    startPage: 87,
    endPage: 107,
    subsections: [
      { titleHy: 'Քառակուսային ֆունկցիա', page: 87 },
      { titleHy: 'Երկրորդ աստիճանի անհավասարումներ։ Ռացիոնալ անհավասարումներ', page: 94 },
      { titleHy: 'Ֆունկցիայի տարրական հետազոտում', page: 101 },
    ],
  },
  {
    id: 'sec-9',
    code: '§ 9',
    titleHy: 'Հավասարումներ և հավասարումների համակարգեր',
    titleRu: 'Уравнения и системы уравнений',
    startPage: 107,
    endPage: 129,
    subsections: [
      { titleHy: 'Բարձր աստիճանների հավասարումներ', page: 107 },
      { titleHy: 'Երկու փոփոխականով հավասարումներ։ Պատկերների տրում կոորդինատային հարթության վրա', page: 114 },
      { titleHy: 'Հավասարումների համակարգի գրաֆիկական լուծում', page: 116 },
      { titleHy: 'Գծային հավասարումների համակարգեր և դրանց բերվող համակարգեր', page: 117 },
      { titleHy: 'Ոչ գծային հավասարումների համակարգեր', page: 119 },
    ],
  },
  {
    id: 'sec-10',
    code: '§ 10',
    titleHy: 'Տեքստային խնդիրներ',
    titleRu: 'Текстовые задачи',
    startPage: 129,
    endPage: 143,
  },
  {
    id: 'sec-11',
    code: '§ 11',
    titleHy: 'Ռացիոնալ ցուցիչով աստիճան',
    titleRu: 'Степень с рациональным показателем',
    startPage: 143,
    endPage: 160,
    subsections: [
      { titleHy: 'n-րդ աստիճանի արմատ և նրա հատկությունները', page: 143 },
      { titleHy: 'Ռացիոնալ ցուցիչով աստիճան և նրա հատկությունները', page: 151 },
      { titleHy: 'Իռացիոնալ հավասարումներ', page: 156 },
      { titleHy: 'Իռացիոնալ անհավասարումներ', page: 159 },
    ],
  },
  {
    id: 'sec-12',
    code: '§ 12',
    titleHy: 'Հաջորդականություններ և պրոգրեսիաներ',
    titleRu: 'Последовательности и прогрессии',
    startPage: 160,
    endPage: 183,
    subsections: [
      { titleHy: 'Հաջորդականություններ', page: 160 },
      { titleHy: 'Մաթեմատիկական ինդուկցիայի մեթոդ', page: 167 },
      { titleHy: 'Թվաբանական պրոգրեսիա', page: 169 },
      { titleHy: 'Երկրաչափական պրոգրեսիա և համակցված խնդիրներ', page: 173 },
      { titleHy: 'Գումարում', page: 177 },
      { titleHy: 'Հաջորդականության սահման։ Անվերջ երկրաչափական պրոգրեսիա', page: 179 },
    ],
  },
  {
    id: 'sec-13',
    code: '§ 13',
    titleHy: 'Եռանկյունաչափական արտահայտություններ և նրանց ձևափոխությունները',
    titleRu: 'Тригонометрические выражения и их преобразования',
    startPage: 183,
    endPage: 201,
    subsections: [
      { titleHy: 'Սինուսի, կոսինուսի, տանգենսի և կոտանգենսի սահմանումը։ Անկյան ռադիանային չափ', page: 183 },
      { titleHy: 'Նույն արգումենտի ֆունկցիաների միջև կախվածությունը։ Բերման բանաձևեր', page: 189 },
      { titleHy: 'Գումարման թեորեմներ', page: 192 },
      { titleHy: 'Կրկնակի և կես արգումենտի բանաձևեր', page: 195 },
      { titleHy: 'Եռանկյունաչափական ֆունկցիաների գումարի ձևափոխումը արտադրյալի և հակառակը', page: 199 },
    ],
  },
  {
    id: 'series',
    code: 'Շարքեր',
    titleHy: 'Թեմատիկ շարքեր ամփոփիչ կրկնության կազմակերպման համար',
    titleRu: 'Тематические серии для организации заключительного повторения',
    startPage: 202,
    endPage: 212,
  },
  {
    id: 'appendix',
    code: 'Հավելված',
    titleHy: 'Հավելված. Ամփոփիչ ստուգողական աշխատանքներ (Աշխատանք 1–20)',
    titleRu: 'Приложение. Обобщающие проверочные работы',
    startPage: 213,
    endPage: 222,
  },
  {
    id: 'exams',
    code: 'Քննություն',
    titleHy: 'Հանրահաշվի քննական աշխատանքների տեքստեր IX դասարանների համար',
    titleRu: 'Тексты экзаменационных работ по алгебре для IX классов',
    startPage: 223,
    endPage: 225,
  },
  {
    id: 'answers',
    code: 'Պատասխաններ',
    titleHy: 'Պատասխաններ. Ցուցումներ. Լուծումներ',
    titleRu: 'Ответы. Указания. Решения',
    startPage: 226,
    endPage: 269,
  },
  {
    id: 'back-matter',
    code: 'Վերջաբան',
    titleHy: 'Բովանդակություն և Հրատարակչական տվյալներ',
    titleRu: 'Оглавление и Выходные данные',
    startPage: 270,
    endPage: 272,
  },
];

export function validatePageNumber(page: number): number {
  if (!Number.isFinite(page) || Number.isNaN(page)) return 1;
  const rounded = Math.trunc(page);
  if (rounded < 1) return 1;
  if (rounded > TOTAL_BOOK_PAGES) return TOTAL_BOOK_PAGES;
  return rounded;
}

export function getSectionForPage(pageNumber: number): BookSection {
  const safePage = validatePageNumber(pageNumber);
  for (let i = BOOK_SECTIONS.length - 1; i >= 0; i--) {
    const s = BOOK_SECTIONS[i];
    if (safePage >= s.startPage && safePage <= s.endPage) {
      return s;
    }
  }
  return BOOK_SECTIONS[0];
}

export function calculateProgressStats(
  pagesMap: Record<number, TranslatedPage>
): ProgressStats {
  let translatedCount = 0;
  for (let p = 1; p <= TOTAL_BOOK_PAGES; p++) {
    if (pagesMap[p]?.translatedMarkdown?.trim()) {
      translatedCount++;
    }
  }
  const remainingCount = TOTAL_BOOK_PAGES - translatedCount;
  const percentage = Math.round((translatedCount / TOTAL_BOOK_PAGES) * 1000) / 10;
  return {
    totalPages: TOTAL_BOOK_PAGES,
    translatedCount,
    remainingCount,
    percentage,
  };
}

export function getSectionProgress(
  section: BookSection,
  pagesMap: Record<number, TranslatedPage>
): { total: number; translated: number; missingPages: number[] } {
  const missingPages: number[] = [];
  let translated = 0;
  for (let p = section.startPage; p <= section.endPage; p++) {
    if (pagesMap[p]?.translatedMarkdown?.trim()) {
      translated++;
    } else {
      missingPages.push(p);
    }
  }
  return {
    total: section.endPage - section.startPage + 1,
    translated,
    missingPages,
  };
}

export function getMissingPages(pagesMap: Record<number, TranslatedPage>): number[] {
  const missing: number[] = [];
  for (let p = 1; p <= TOTAL_BOOK_PAGES; p++) {
    if (!pagesMap[p]?.translatedMarkdown?.trim()) {
      missing.push(p);
    }
  }
  return missing;
}

export function buildCompiledBookMarkdown(
  pagesMap: Record<number, TranslatedPage>
): string {
  const parts: string[] = [
    '# Մ. Լ. Գալիցկի, Ա. Մ. Գոլդման, Լ. Ի. Զվավիչ — ՀԱՆՐԱՀԱՇՎԻ ԽՆԴՐԱԳԻՐՔ (8–9 դաս.)\n',
    '_Ուսումնական ձեռնարկ մաթեմատիկայի խորացված ուսումնասիրությամբ 8–9 դասարանների համար — Ամբողջական հայերեն թարգմանություն_\n',
    '---\n',
  ];

  for (let p = 1; p <= TOTAL_BOOK_PAGES; p++) {
    const entry = pagesMap[p];
    if (entry && entry.translatedMarkdown.trim()) {
      parts.push(`\n<!-- Էջ ${p} -->\n## Էջ ${p} · ${entry.sectionTitle}\n\n${entry.translatedMarkdown.trim()}\n\n---\n`);
    }
  }

  return parts.join('\n');
}

export function buildCompiledBookHtml(
  pagesMap: Record<number, TranslatedPage>
): string {
  const sectionsHtml: string[] = [];

  for (let p = 1; p <= TOTAL_BOOK_PAGES; p++) {
    const entry = pagesMap[p];
    if (!entry || !entry.translatedMarkdown.trim()) continue;
    const escaped = entry.translatedMarkdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    sectionsHtml.push(
      `<section class="book-page" data-page="${p}">
        <div class="page-header">Էջ ${p} — ${escapeHtml(entry.sectionTitle)}</div>
        <div class="page-body"><pre class="md-source">${escaped}</pre></div>
      </section>`
    );
  }

  return `<!DOCTYPE html>
<html lang="hy">
<head>
  <meta charset="UTF-8" />
  <title>Հանրահաշվի խնդրագիրք 8–9 դաս. (Գալիցկի) — Հայերեն թարգմանություն</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css" />
  <style>
    body { font-family: 'Noto Sans Armenian', 'Sylfaen', system-ui, sans-serif; max-width: 860px; margin: 40px auto; padding: 0 24px; color: #0f172a; line-height: 1.75; }
    h1 { font-size: 24px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; }
    .book-page { margin: 28px 0; padding-bottom: 24px; border-bottom: 1px solid #cbd5e1; page-break-inside: avoid; }
    .page-header { font-size: 13px; font-weight: 700; color: #0284c7; margin-bottom: 10px; }
    .md-source { white-space: pre-wrap; font-family: inherit; font-size: 15px; margin: 0; }
  </style>
</head>
<body>
  <h1>Մ. Լ. Գալիցկի, Ա. Մ. Գոլդման, Լ. Ի. Զվավիչ — Հանրահաշվի խնդրագիրք (8–9 դաս.)</h1>
  <p><em>Հայերեն թարգմանություն (բոլոր մաթեմատիկական արտահայտություններն ու բանաձևերը պահպանված են անփոփոխ)</em></p>
  ${sectionsHtml.join('\n')}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
