import { NextRequest, NextResponse } from 'next/server';
import { ThinkingLevel, Type } from '@google/genai';
import { validatePageNumber, getSectionForPage, TOTAL_BOOK_PAGES } from '@/lib/book-structure';
import { extractSinglePagePdfBytes, getGeminiClient } from '@/lib/gemini-server';

export const runtime = 'nodejs';

const WATERFALL_MODELS = [
  'gemini-4-hydrogen',
  'gemini-3.8-flash',
  'gemini-3.1-pro-preview',
  'gemini-3.5-flash-lite',
] as const;

const VERIFICATION_SYSTEM_INSTRUCTION = `Դուք ակադեմիական մաթեմատիկայի գլխավոր խմբագիր և ստուգիչ-տեսուչ եք։
Ձեր նպատակն է ՄԱՆՐԱՄԱՍՆ, ՏՈՂ ԱՌ ՏՈՂ (line-by-line) ստուգել և ԱՎՏՈՄԱՏ ՈՒՂՂԵԼ տրված ռուսերեն բնօրինակ PDF էջը (Մ. Լ. Գալիցկու «Հանրահաշվի խնդրագիրք») և դրա հայերեն Markdown/LaTeX թարգմանությունը։

ՍՏՈՒԳՄԱՆ ԵՎ ՇՏԿՄԱՆ ԽԻՍՏ ՉԱՓԱՆԻՇՆԵՐ.
1. ԽՆԴԻՐՆԵՐԻ ՀԱՄԱՐՆԵՐ ԵՎ ԵՆԹԱԿԵՏԵՐ.
   - Բոլոր համարները պետք է ճշգրիտ համընկնեն բնօրինակին (օր.՝ 1.1, 8.24)։
   - Ենթակետերի ռուսերեն տառերը (а, б, в, г, դ, ե, զ...) փոխարինեք հայկականով՝ ա, բ, գ, դ, ե, զ, է, ը, թ, ժ, ի, լ, ն (в -> գ, ոչ թե վ)։
2. ՄԱԹԵՄԱՏԻԿԱԿԱՆ ԱՐՏԱՀԱՅՏՈՒԹՅՈՒՆՆԵՐ ԵՎ ԹՎԵՐ.
   - Ոչ մի թիվ, գործակից, փոփոխական, աստիճան, հավասարում չպետք է փոխված կամ բաց թողնված լինի։
   - LaTeX բանաձևերը պետք է լինեն մաքուր՝ $...$ կամ $$...$$։ Բացառել ot\\text{=} կամ \\boxed{\\text{ }}։
3. ՇՏԿՎԱԾ ՄԱՐՔԴԱՈՒՆ (improvedMarkdown).
   - Վերադարձրեք էջի ամբողջական, կատարելագործված և ճշգրիտ հայերեն Markdown/LaTeX տարբերակը։`;

function getThinkingConfig(modelName: string) {
  if (modelName === 'gemini-4-hydrogen' || modelName.includes('pro')) {
    return { thinkingLevel: ThinkingLevel.LOW };
  }
  return { thinkingLevel: ThinkingLevel.LOW };
}

async function verifyAndCorrectSinglePage(
  pageNumber: number,
  existingMarkdown: string,
  preferredModel?: string
): Promise<{ pageNumber: number; improvedMarkdown: string; accuracyScore: number; modelUsed: string }> {
  const safePage = validatePageNumber(pageNumber);
  const section = getSectionForPage(safePage);
  const pdfBytes = await extractSinglePagePdfBytes(safePage);
  const base64Pdf = Buffer.from(pdfBytes).toString('base64');

  const promptText = `Խնդրում եմ ստուգել և շտկել Գալիցկու «Հանրահաշվի խնդրագիրք» գրքի ԷՋ № ${safePage} (Բաժին՝ ${section.code} — ${section.titleHy}) տող առ տող։
Կցված է ռուսերեն PDF բնօրինակը։
Առկա հայերեն թարգմանություն՝
\`\`\`markdown
${existingMarkdown || '(Թարգմանությունը բացակայում է)'}
\`\`\`

Ստուգեք ռուսերեն բնօրինակի հետ, վերացրեք ցանկացած անճշտություն և վերադարձրեք improvedMarkdown դաշտում էջի 100% ճշգրիտ և ամբողջական հայերեն Markdown/LaTeX տարբերակը։`;

  let modelSequence: string[];
  if (preferredModel && preferredModel !== 'auto') {
    modelSequence = [preferredModel, ...WATERFALL_MODELS.filter((m) => m !== preferredModel)];
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
            { text: `=== ԲՆՕՐԻՆԱԿ PDF ԷՋ № ${safePage} ===` },
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64Pdf,
              },
            },
            { text: promptText },
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
              accuracyScore: { type: Type.INTEGER },
              improvedMarkdown: {
                type: Type.STRING,
                description: 'Ամբողջական էջի շտկված և կատարելագործված Markdown տարբերակը',
              },
            },
            required: ['pageNumber', 'accuracyScore', 'improvedMarkdown'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) throw new Error('Դատարկ պատասխան ստուգման ժամանակ');

      const parsed = JSON.parse(rawText) as {
        pageNumber?: number;
        accuracyScore?: number;
        improvedMarkdown?: string;
      };

      const improved = parsed.improvedMarkdown?.trim() || existingMarkdown;
      return {
        pageNumber: safePage,
        improvedMarkdown: improved,
        accuracyScore: typeof parsed.accuracyScore === 'number' ? parsed.accuracyScore : 95,
        modelUsed: model,
      };
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

      console.warn(`[Verify-Book Waterfall] Մոդել ${model} ձախողվեց էջ ${safePage}-ի համար: ${msg.slice(0, 100)}`);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Էջ ${safePage}-ի ստուգման բոլոր մոդելները սպառված են`);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      pages?: number[];
      model?: string;
    };

    let targetPages: number[] = [];
    if (Array.isArray(body.pages) && body.pages.length > 0) {
      targetPages = body.pages.map((p) => validatePageNumber(p));
    } else {
      // Default: verify pages 1 to 272
      for (let p = 1; p <= TOTAL_BOOK_PAGES; p++) {
        targetPages.push(p);
      }
    }

    // Limit batch verify to 16 pages per request to prevent timeouts
    const slice = targetPages.slice(0, 16);
    const results: Array<{
      pageNumber: number;
      improvedMarkdown: string;
      accuracyScore: number;
      modelUsed: string;
    }> = [];

    for (const p of slice) {
      try {
        const res = await verifyAndCorrectSinglePage(p, '', body.model);
        results.push(res);
      } catch (err) {
        console.warn(`Failed verifying page ${p}:`, err);
      }
    }

    return NextResponse.json({
      verifiedPages: results,
      remainingCount: Math.max(0, targetPages.length - slice.length),
      nextPages: targetPages.slice(16),
      modelUsed: results[0]?.modelUsed || 'auto',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Սխալ գրքի ստուգման ընթացքում';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
