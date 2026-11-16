import { NextRequest, NextResponse } from 'next/server';
import { ThinkingLevel, Type } from '@google/genai';
import { getSectionForPage, validatePageNumber } from '@/lib/book-structure';
import {
  extractSinglePagePdfBytes,
  getGeminiClient,
  normalizeRequestedPages,
} from '@/lib/gemini-server';

export const runtime = 'nodejs';

const TRANSLATION_SYSTEM_INSTRUCTION = `Դուք պրոֆեսիոնալ մաթեմատիկայի խմբագիր և թարգմանիչ եք ռուսերենից հայերեն։
Ձեր առաջադրանքն է ամբողջությամբ, նույնությամբ և ճշգրիտ հայերեն թարգմանել Մ. Լ. Գալիցկու, Ա. Մ. Գոլդմանի և Լ. Ի. Զվավիչի «Հանրահաշվի խնդրագիրք (8–9 դասարաններ)» գրքի տրված PDF էջ(եր)ը։

ԽԻՍՏ ՊԱՀԱՆՋՆԵՐ.
1. ՊԱՀՊԱՆԵՔ ԱՄԲՈՂՋ ՄԱԹԵՄԱՏԻԿԱԿԱՆ ԲՈՎԱՆԴԱԿՈՒԹՅՈՒՆԸ ԱՆՓՈՓՈԽ. ոչ մի թիվ, գործակից, փոփոխական (x, y, z, a, b, c, m, n, k, p, q և այլն), ցուցիչ, կոտորակ, արմատ, նշան, հավասարում, անհավասարում, համակարգ, միջակայք, խնդրի համար (օր.՝ **1.1.**, **5.24.**) կամ պատասխան չի կարելի փոխել, բաց թողնել կամ կրճատել։
2. Բոլոր մաթեմատիկական արտահայտությունները ձևավորեք մաքուր LaTeX-ով.
   - Տողային բանաձևերը՝ $...$ (տողային $...$ արտահայտությունը պետք է լինի ՄԵԿ տողի վրա և փակված լինի $)
   - Առանձին տողով բանաձևերը՝ $$...$$ (միշտ դատարկ տող թողեք յուրաքանչյուր $$...$$ բլոկից առաջ և հետո)
   - Կոտորակները՝ \\frac{...}{...}, արմատները՝ \\sqrt{...}, \\sqrt[n]{...} (երբեք մի օգտագործեք \\boxed արմատի փոխարեն), համակարգերը՝ \\begin{cases} ... \\end{cases}
   - Ստուգեք նշանները շատ ուշադիր՝ \\cdot, \\pm, \\neq, \\leqslant, \\geqslant, \\in, \\notin, \\mathbf{R}, \\mathbf{N}։ ԵՐԲԵՔ մի գրեք աղավաղված ot\\text{=}, \\not\\text{=} կամ \\boxed{\\text{ }}։
   - Եռանկյունաչափական ֆունկցիաները գրեք \\sin, \\cos, \\operatorname{tg}, \\operatorname{ctg}, \\operatorname{arctg}, \\operatorname{arcctg}։
   - Տասնորդական ստորակետը բանաձևերում գրեք որպես {,} (օր.՝ $0{,}25$)։
3. ԵՐԲԵՔ ՀԱՅԵՐԵՆ ՆԱԽԱԴԱՍՈՒԹՅՈՒՆՆԵՐԸ, ԽՆԴԻՐՆԵՐԻ ՀԱՄԱՐՆԵՐԸ, ԵՆԹԱԿԵՏԵՐԸ (ա), բ)) ԿԱՄ «Ցուցում.», «Լուծում.» ԲԱՌԵՐԸ ՄԻ ԴՐԵՔ $...$-Ի ԵՎ \\text{...}-Ի ՆԵՐՍՈՒՄ։
   - Հայերեն տեքստը գրեք սովորական Markdown-ով, իսկ $...$-ի մեջ դրեք ՄԻԱՅՆ մաթեմատիկական բանաձևերը։
   - \\text{...} օգտագործեք միայն շատ կարճ կապերի համար բանաձևի ներսում (օր.՝ \\begin{cases} ... \\text{ երբ } x \\ge 0 \\end{cases})։
4. ՄԱԹԵՄԱՏԻԿԱՅԻՑ ԴՈՒՐՍ ՄԻԱՅՆ ԲԱՌԵՐԸ թարգմանեք գեղեցիկ, գրագետ և ակադեմիական հայերենով.
   - Ենթակետերի ռուսական տառերը՝ а), б), в), г), д), е), ж), з), и), к), л), м), н) խիստ հերթականությամբ փոխարինեք հայկականով՝ ա), բ), գ), դ), ե), զ), է), ը), թ), ժ), ի), լ), ն) (в) -> գ), գրեք միշտ գ), ոչ թե վ))։
   - НОД -> ԱԸԲ, НОК -> ԱԸԲազմ, Рис. -> Նկ.։
5. Ամբողջ էջը թարգմանեք սկզբից մինչև վերջ՝ ներառյալ վերնագրերը, տեսական նյութը, օրինակների լուծումները, վարժությունները, ծանոթագրությունները և պատասխանները։ Բազմաէջ հարցման դեպքում վերադարձրեք ՅՈՒՐԱՔԱՆՉՅՈՒՐ էջի ամբողջական թարգմանությունը համապատասխան pageNumber-ով՝ միայն պահանջվող JSON օբյեկտով։`;

interface TranslatedPagePayload {
  pageNumber: number;
  sectionTitle: string;
  translatedMarkdown: string;
  model: string;
}

const WATERFALL_MODELS = [
  'gemini-4-hydrogen',
  'gemini-3.1-pro-preview',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
] as const;

function getThinkingConfigForModel(modelName: string, requestedMode: 'minimal' | 'low') {
  if (
    modelName === 'gemini-4-hydrogen' ||
    modelName.includes('pro') ||
    modelName.includes('argon') ||
    modelName.includes('carbon')
  ) {
    // gemini-4-hydrogen and pro models do NOT support ThinkingLevel.MINIMAL (400 error)
    return { thinkingLevel: ThinkingLevel.LOW };
  }
  if (modelName === 'gemini-3.1-flash-lite') {
    return {
      thinkingLevel: requestedMode === 'low' ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL,
    };
  }
  return { thinkingLevel: ThinkingLevel.LOW };
}

async function translatePagesInSingleCall(
  pageNumbers: number[],
  modelName: string,
  thinkingMode: 'minimal' | 'low' = 'low'
): Promise<TranslatedPagePayload[]> {
  const ai = getGeminiClient();

  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];

  for (const p of pageNumbers) {
    const safePage = validatePageNumber(p);
    const section = getSectionForPage(safePage);
    const pdfBytes = await extractSinglePagePdfBytes(safePage);
    const base64Pdf = Buffer.from(pdfBytes).toString('base64');

    parts.push({
      text: `=== PDF ԷՋ № ${safePage} (Բաժին՝ ${section.code} — ${section.titleHy}) ===`,
    });
    parts.push({
      inlineData: {
        mimeType: 'application/pdf',
        data: base64Pdf,
      },
    });
  }

  parts.push({
    text: `Վերևում տրված են Գալիցկու «Հանրահաշվի խնդրագիրք (8–9 դաս.)» գրքի ${pageNumbers.length} PDF էջեր՝ հետևյալ հաջորդականությամբ՝ [${pageNumbers.join(', ')}]։
Թարգմանեք ԲՈԼՈՐ ${pageNumbers.length} էջերից յուրաքանչյուրը ԱՌԱՆՁԻՆ և ԱՄԲՈՂՋՈՒԹՅԱՄԲ՝ պահպանելով բոլոր թվերը, խնդիրների համարները, հավասարումները, անհավասարումները, արմատներն ու պատասխանները անփոփոխ։
Հիշեք. հայերեն տեքստը, խնդիրների համարները և «Ցուցում.» / «Լուծում.» բառերը գրեք $...$-ից ԴՈՒՐՍ, իսկ արմատները գրեք \\sqrt{...}-ով։
Վերադարձրեք JSON՝ "pages" զանգվածով, որտեղ կա ուղիղ ${pageNumbers.length} տարր՝ pageNumber-ով [${pageNumbers.join(', ')}]։`,
  });

  let lastError: unknown = null;
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts },
        config: {
          systemInstruction: TRANSLATION_SYSTEM_INSTRUCTION,
          thinkingConfig: getThinkingConfigForModel(modelName, thinkingMode),
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              pages: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    pageNumber: {
                      type: Type.INTEGER,
                      description: 'Էջի ճշգրիտ PDF համարը',
                    },
                    sectionTitle: {
                      type: Type.STRING,
                      description: 'Էջի կարճ հայերեն վերնագիրը կամ բաժնի անվանումը',
                    },
                    translatedMarkdown: {
                      type: Type.STRING,
                      description: 'Ամբողջ էջի ճշգրիտ հայերեն թարգմանությունը Markdown և LaTeX ($...$, $$...$$) ձևաչափով',
                    },
                  },
                  required: ['pageNumber', 'sectionTitle', 'translatedMarkdown'],
                },
              },
            },
            required: ['pages'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new Error(`Դատարկ պատասխան էջերի համար (${pageNumbers.join(', ')})`);
      }

      const parsed = JSON.parse(rawText) as {
        pages?: Array<{
          pageNumber?: number;
          sectionTitle?: string;
          translatedMarkdown?: string;
        }>;
      };

      const returnedPages = parsed.pages ?? [];
      const resultsByPage = new Map<number, TranslatedPagePayload>();

      for (let i = 0; i < returnedPages.length; i++) {
        const item = returnedPages[i];
        const candidateNum =
          typeof item.pageNumber === 'number' && pageNumbers.includes(item.pageNumber)
            ? item.pageNumber
            : pageNumbers[i];

        if (!candidateNum) continue;
        const safePage = validatePageNumber(candidateNum);
        const section = getSectionForPage(safePage);
        const rawMd = (item.translatedMarkdown ?? '').trim();
        if (!rawMd) continue;

        const md = rawMd
          .replace(/\r\n/g, '\n')
          .replace(/\f/g, '\\f')
          .replace(/\x08/g, '\\b')
          .replace(/\t/g, '\\t')
          .replace(/\r/g, '\\r')
          .replace(/(\$[^$\n]*)\n(eq|ot|otin)\b/g, '$1\\n$2');

        resultsByPage.set(safePage, {
          pageNumber: safePage,
          sectionTitle: item.sectionTitle?.trim() || `${section.code}. ${section.titleHy}`,
          translatedMarkdown: md,
          model: modelName,
        });
      }

      const orderedResults: TranslatedPagePayload[] = [];
      for (const p of pageNumbers) {
        const entry = resultsByPage.get(p);
        if (entry) {
          orderedResults.push(entry);
        }
      }

      if (orderedResults.length === 0) {
        throw new Error(`Չստացվեց վավեր թարգմանություն էջերի համար (${pageNumbers.join(', ')})`);
      }

      return orderedResults;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('PerDay') ||
        msg.includes('quota') ||
        msg.includes('404') ||
        msg.includes('NOT_FOUND') ||
        msg.includes('no longer available') ||
        msg.includes('not found')
      ) {
        throw err;
      }
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Չհաջողվեց թարգմանել էջերը [${pageNumbers.join(', ')}] ${modelName} մոդելով`);
}

async function translateWithModelFallback(
  pageNumbers: number[],
  preferredModel?: string,
  forceModel = false,
  thinkingMode: 'minimal' | 'low' = 'low'
): Promise<{ pages: TranslatedPagePayload[]; usedModel: string }> {
  let modelSequence: string[];

  if (preferredModel && preferredModel !== 'auto') {
    if (forceModel) {
      modelSequence = [preferredModel];
    } else {
      modelSequence = [
        preferredModel,
        ...WATERFALL_MODELS.filter((m) => m !== preferredModel),
      ];
    }
  } else {
    // Default waterfall requested:
    // 1. Gemini 4 Hydrogen
    // 2. Gemini 3 Pro (gemini-3.1-pro-preview)
    // 3. Gemini Flash (gemini-2.5-flash)
    // 4. Gemini Flash Lite (gemini-3.1-flash-lite)
    modelSequence = [...WATERFALL_MODELS];
  }

  let lastError: unknown = null;

  for (const model of modelSequence) {
    try {
      const results = await translatePagesInSingleCall(pageNumbers, model, thinkingMode);
      return { pages: results, usedModel: model };
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isQuotaOrLimit =
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('PerDay') ||
        msg.includes('quota') ||
        msg.includes('rate') ||
        msg.includes('404') ||
        msg.includes('NOT_FOUND') ||
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('no longer available') ||
        msg.includes('not found') ||
        msg.includes('is not found');

      console.warn(
        `[Translate Waterfall] Մոդել ${model} ձախողվեց (quota/limit=${isQuotaOrLimit}): ${msg.slice(0, 160)}`
      );

      if (!isQuotaOrLimit && forceModel) {
        throw err;
      }
      // If quota was hit or not found, proceed to next model in the waterfall
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Բոլոր մոդելները (${modelSequence.join(' → ')}) սպառված են կամ անհասանելի։`);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      page?: number;
      pages?: number[];
      model?: string;
      forceModel?: boolean;
      thinking?: 'minimal' | 'low';
    };

    let targetPages: number[] = [];
    if (Array.isArray(body.pages) && body.pages.length > 0) {
      targetPages = normalizeRequestedPages(body.pages);
    } else if (typeof body.page === 'number') {
      targetPages = [validatePageNumber(body.page)];
    }

    if (targetPages.length === 0) {
      return NextResponse.json(
        { error: 'Խնդրում ենք նշել վավեր էջի համար (1–272)։' },
        { status: 400 }
      );
    }

    const thinkingMode = body.thinking === 'minimal' ? 'minimal' : 'low';
    const { pages, usedModel } = await translateWithModelFallback(
      targetPages,
      body.model,
      Boolean(body.forceModel),
      thinkingMode
    );

    return NextResponse.json({ pages, modelUsed: usedModel });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Անհայտ սխալ թարգմանության ընթացքում';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
