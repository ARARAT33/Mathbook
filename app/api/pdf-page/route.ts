import { NextRequest, NextResponse } from 'next/server';
import { validatePageNumber } from '@/lib/book-structure';
import { extractSinglePagePdfBytes } from '@/lib/gemini-server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const pageParam = req.nextUrl.searchParams.get('page');
    const parsed = pageParam ? Number(pageParam) : 1;
    const pageNumber = validatePageNumber(parsed);

    const pdfBytes = await extractSinglePagePdfBytes(pageNumber);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="galitsky-page-${pageNumber}.pdf"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PDF էջի բեռնման սխալ';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
