import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { GoogleGenAI } from '@google/genai';
import { TOTAL_BOOK_PAGES, validatePageNumber } from './book-structure';

const PDF_RELATIVE_PATH = 'public/assets/aistudio/Galitsky_Sbornik_zadach_po_algebre_8-9_klass_a8230205.pdf';

let cachedPdfDocPromise: Promise<PDFDocument> | null = null;
let cachedAiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY միջավայրի փոփոխականը կարգավորված չէ սերվերում։');
  }
  if (!cachedAiClient) {
    cachedAiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedAiClient;
}

export async function getSourcePdfDocument(): Promise<PDFDocument> {
  if (!cachedPdfDocPromise) {
    cachedPdfDocPromise = (async () => {
      const fullPath = path.join(process.cwd(), PDF_RELATIVE_PATH);
      const bytes = await fs.readFile(fullPath);
      return PDFDocument.load(bytes);
    })().catch((err) => {
      cachedPdfDocPromise = null;
      throw err;
    });
  }
  return cachedPdfDocPromise;
}

export async function extractSinglePagePdfBytes(pageNumber: number): Promise<Uint8Array> {
  const safePage = validatePageNumber(pageNumber);
  const srcDoc = await getSourcePdfDocument();
  const pageCount = srcDoc.getPageCount();
  const index = Math.min(Math.max(safePage - 1, 0), pageCount - 1);

  const singleDoc = await PDFDocument.create();
  const [copiedPage] = await singleDoc.copyPages(srcDoc, [index]);
  singleDoc.addPage(copiedPage);
  return singleDoc.save();
}

export async function extractMultiPagePdfBytes(pageNumbers: number[]): Promise<Uint8Array> {
  const srcDoc = await getSourcePdfDocument();
  const pageCount = srcDoc.getPageCount();
  const indices = pageNumbers.map((p) => {
    const safePage = validatePageNumber(p);
    return Math.min(Math.max(safePage - 1, 0), pageCount - 1);
  });

  const batchDoc = await PDFDocument.create();
  const copiedPages = await batchDoc.copyPages(srcDoc, indices);
  for (const copiedPage of copiedPages) {
    batchDoc.addPage(copiedPage);
  }
  return batchDoc.save();
}

export function normalizeRequestedPages(input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  const unique = new Set<number>();
  for (const val of input) {
    const num = Number(val);
    if (Number.isInteger(num) && num >= 1 && num <= TOTAL_BOOK_PAGES) {
      unique.add(num);
    }
  }
  return Array.from(unique).slice(0, 16);
}
