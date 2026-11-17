import { NextRequest, NextResponse } from 'next/server';
import { ThinkingLevel, Type } from '@google/genai';
import { validatePageNumber, getSectionForPage } from '@/lib/book-structure';
import { extractSinglePagePdfBytes, getGeminiClient } from '@/lib/gemini-server';

export const runtime = 'nodejs';

const WATERFALL_MODELS = [
  'gemini-4-hydrogen',
  'gemini-3.8-flash',
  'gemini-3.1-pro-preview',
  'gemini-3.5-flash-lite',
] as const;

const VERIFICATION_SYSTEM_INSTRUCTION = `Դուք ակադեմիական մաթեմատիկայի գլխավոր խմբագիր և ստուգիչ-տեսուչ եք։
Ձեր նպատակն է ՄԱՆՐԱՄԱՍՆ, ՏՈՂ ԱՌ ՏՈՂ (line-by-line) համեմատել տրված ռուսերեն բնօրինակ PDF էջը (Մ. Լ. Գալիցկու «Հանրահաշվի խնդրագիրք») և դրա հայերեն Markdown/LaTeX թարգմանությունը։

ՍՏՈՒԳՄԱՆ ԽԻՍՏ ՉԱՓԱՆԻՇՆԵՐ.
1. ԽՆԴԻՐՆԵՐԻ ՀԱՄԱՐՆԵՐ ԵՎ ԵՆԹԱԿԵՏԵՐ.
   - Բոլոր համարները (օր.՝ 1.1, 1.2, 5.14, 8.25) պետք է ճշգրիտ համընկնեն բնօրինակին։
   - Ենթակետերի ռուսերեն տառերը (а, б, в, г, д, е, ж, з, и, к, л, м, н) պետք է ճշգրիտ համապատասխանեն հայկական այբուբենի հերթականությանը (ա, բ, գ, դ, ե, զ, է, ը, թ, ժ, ի, լ, ն)։ Հատկապես ստուգեք в) -> գ) (ոչ թե վ))։
2. ՄԱԹԵՄԱՏԻԿԱԿԱՆ ԱՐՏԱՀԱՅՏՈՒԹՅՈՒՆՆԵՐ ԵՎ ԹՎԵՐ.
   - Ոչ մի թիվ, գործակից, աստիճան, ցուցիչ, հավասարման նշան, անհավասարման նշան (<=, >=, <, >), արմատի ցուցիչ չպետք է փոխված կամ աղավաղված լինի։
   - LaTeX բանաձևերը պետք է լինեն մաքուր՝ $...$ կամ $$...$$։ Բացառել ot\\text{=} կամ \\boxed{\\text{ }} աղավաղումները։
   - Կոտորակները՝ \\frac{...}{...}, արմատները՝ \\sqrt{...}։
3. ՏԵՔՍՏԱՅԻՆ ԹԱՐԳՄԱՆՈՒԹՅԱՆ ՃՇԳՐՏՈՒԹՅՈՒՆ.
   - Հայերեն թարգմանությունը պետք է լինի գրագետ, մաթեմատիկորեն ճիշտ («լուծել հավասարումը», «պարզեցնել արտահայտությունը», «գտնել արժեքը» և այլն)։
   - Տեքստում չպետք է լինեն բաց թողնված պայմաններ, ցուցումներ կամ պատասխաններ։
4. ՏՈՂ ԱՌ ՏՈՂ ՀԱՄԵՄԱՏՈՒԹՅՈՒՆ.
   - Տրոհեք էջի բովանդակությունը տրամաբանական տողերի կամ կետերի (վերնագիր, խնդիր, ենթակետ)։
   - Յուրաքանչյուր կետի համար նշեք բնօրինակ ռուսերեն տողը, հայերեն թարգմանված տողը, կարգավիճակը ('match', 'minor_difference', 'formula_error', 'missing') և կարճ մեկնաբանությունը։
5. ՇՏԿՎԱԾ ՄԱՐՔԴԱՈՒՆ (improvedMarkdown).
   - Եթե կան տարբերություններ կամ սխալներ, improvedMarkdown դաշտում տվեք ամբողջական էջի կատարյալ, շտկված Markdown/LaTeX տարբերակը։ Եթե ամեն ինչ անթերի է, պահպանեք գոյություն ունեցող տարբերակը։`;

function getThinkingConfig(modelName: string) {
  if (modelName === 'gemini-4-hydrogen' || modelName.includes('pro')) {
    return { thinkingLevel: ThinkingLevel.LOW };
  }
  return { thinkingLevel: ThinkingLevel.LOW };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      page: number;
      markdown?: string;
      model?: string;
      forceModel?: boolean;
    };

    const safePage = validatePageNumber(body.page);
    const section = getSectionForPage(safePage);
    const pdfBytes = await extractSinglePagePdfBytes(safePage);
    const base64Pdf = Buffer.from(pdfBytes).toString('base64');

    const markdownToVerify = body.markdown?.trim() || '';

    const promptText = `Խնդրում եմ կատարել Գալիցկու «Հանրահաշվի խնդրագիրք» գրքի ԷՋ № ${safePage} (Բաժին՝ ${section.code} — ${section.titleHy}) մանրամասն տող առ տող համեմատական ստուգում։
Կցված է բնօրինակ PDF էջը։
Ստորև բերված է առկա հայերեն Markdown թարգմանությունը.
\`\`\`markdown
${markdownToVerify || '(Թարգմանությունը բացակայում է)'}
\`\`\`

Համեմատեք տող առ տող ռուսերեն PDF բնօրինակի հետ.
1. Ստուգեք յուրաքանչյուր խնդրի համար, ենթակետ (ա, բ, գ...), բանաձև, թիվ, հավասարում և տեքստային պահանջ։
2. Տվեք ճշգրտության գնահատական (0-100%) և կարգավիճակ։
3. Յուրաքանչյուր տողի/խնդրի համար տվեք lineComparisons զանգված՝ [originalRu] vs [translationHy]։
4. Եթե հայտնաբերեք որևէ բացթողում, սխալ թիվ կամ անճշտություն, ներկայացրեք suggestedCorrections և improvedMarkdown։`;

    let modelSequence: string[];
    if (body.model && body.model !== 'auto') {
      if (body.forceModel) {
        modelSequence = [body.model];
      } else {
        modelSequence = [body.model, ...WATERFALL_MODELS.filter((m) => m !== body.model)];
      }
    } else {
      modelSequence = [...WATERFALL_MODELS];
    }

    const ai = getGeminiClient();
    let lastError: unknown = null;

    for (const model of modelSequence) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: {
            parts: [
              {
                text: `=== ԲՆՕՐԻՆԱԿ PDF ԷՋ № ${safePage} ===`,
              },
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: base64Pdf,
                },
              },
              {
                text: promptText,
              },
            ],
          },
          config: {
            systemInstruction: VERIFICATION_SYSTEM_INSTRUCTION,
            thinkingConfig: getThinkingConfig(model),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                pageNumber: { type: Type.INTEGER },
                accuracyScore: {
                  type: Type.INTEGER,
                  description: 'Թարգմանության ճշգրտության տոկոսը (0-100)',
                },
                overallStatus: {
                  type: Type.STRING,
                  enum: ['exact_match', 'minor_differences', 'needs_attention'],
                  description: 'Ընդհանուր կարգավիճակ',
                },
                summaryHy: {
                  type: Type.STRING,
                  description: 'Համեմատական ստուգման համառոտ ամփոփում հայերենով',
                },
                lineComparisons: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      lineNumber: { type: Type.INTEGER },
                      itemLabel: {
                        type: Type.STRING,
                        description: 'Խնդրի համարը կամ տողի անվանումը (օր.՝ Խնդիր 4.12 բ)',
                      },
                      originalRu: {
                        type: Type.STRING,
                        description: 'Բնօրինակ ռուսերեն տողը կամ արտահայտությունը',
                      },
                      translationHy: {
                        type: Type.STRING,
                        description: 'Հայերեն թարգմանված տողը կամ արտահայտությունը',
                      },
                      status: {
                        type: Type.STRING,
                        enum: ['match', 'minor_difference', 'formula_error', 'missing'],
                      },
                      comment: {
                        type: Type.STRING,
                        description: 'Դիտողություն կամ համապատասխանության նկարագրություն',
                      },
                    },
                    required: ['itemLabel', 'originalRu', 'translationHy', 'status'],
                  },
                },
                suggestedCorrections: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      location: { type: Type.STRING },
                      currentText: { type: Type.STRING },
                      suggestedText: { type: Type.STRING },
                      reason: { type: Type.STRING },
                    },
                    required: ['location', 'currentText', 'suggestedText', 'reason'],
                  },
                },
                improvedMarkdown: {
                  type: Type.STRING,
                  description: 'Ամբողջական էջի շտկված և կատարելագործված Markdown տարբերակը',
                },
              },
              required: [
                'pageNumber',
                'accuracyScore',
                'overallStatus',
                'summaryHy',
                'lineComparisons',
              ],
            },
          },
        });

        const rawText = (response.text ?? '').trim();
        if (!rawText) {
          throw new Error('Սերվերը վերադարձրեց դատարկ ստուգման պատասխան');
        }

        const parsed = JSON.parse(rawText);
        return NextResponse.json({
          verification: {
            ...parsed,
            pageNumber: safePage,
          },
          modelUsed: model,
        });
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isQuota =
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('PerDay') ||
          msg.includes('quota') ||
          msg.includes('404') ||
          msg.includes('NOT_FOUND');

        console.warn(`[Verify Waterfall] Մոդել ${model} ձախողվեց: ${msg.slice(0, 150)}`);
        if (!isQuota && body.forceModel) {
          throw err;
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Ստուգման բոլոր մոդելները սպառված են կամ անհասանելի');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Սխալ էջի ստուգման ընթացքում';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
