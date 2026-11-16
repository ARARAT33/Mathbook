'use client';

import React, { useMemo, useState } from 'react';
import {
  Cloud,
  Download,
  Printer,
  Search,
  ExternalLink,
  Sparkles,
  FileText,
  FileCode2,
  RotateCw,
} from 'lucide-react';
import {
  TOTAL_BOOK_PAGES,
  buildCompiledBookMarkdown,
  calculateProgressStats,
  getModelBadgeInfo,
  type TranslatedPage,
} from '@/lib/book-structure';
import {
  buildFullBookDocxBlob,
  buildFullBookHtmlDocument,
  buildFullBookPdfBlob,
} from '@/lib/exporters';
import { MathRenderer } from './MathRenderer';

interface CompiledBookViewProps {
  pagesMap: Record<number, TranslatedPage>;
  onOpenPage: (page: number) => void;
  onOpenDriveModal: () => void;
  onSwitchToBatch: () => void;
}

export function CompiledBookView({
  pagesMap,
  onOpenPage,
  onOpenDriveModal,
  onSwitchToBatch,
}: CompiledBookViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleLimit, setVisibleLimit] = useState<number>(30);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isExportingHtml, setIsExportingHtml] = useState(false);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const stats = calculateProgressStats(pagesMap);

  const orderedPages = useMemo(() => {
    const list: TranslatedPage[] = [];
    const q = searchTerm.trim().toLowerCase();
    for (let p = 1; p <= TOTAL_BOOK_PAGES; p++) {
      const item = pagesMap[p];
      if (!item || !item.translatedMarkdown?.trim()) continue;
      if (q) {
        const matches =
          item.translatedMarkdown.toLowerCase().includes(q) ||
          item.sectionTitle.toLowerCase().includes(q) ||
          String(item.pageNumber) === q;
        if (!matches) continue;
      }
      list.push(item);
    }
    return list;
  }, [pagesMap, searchTerm]);

  const displayedPages = searchTerm.trim()
    ? orderedPages
    : orderedPages.slice(0, visibleLimit);

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    setExportError(null);
    try {
      const blob = await buildFullBookPdfBlob(pagesMap);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Galitsky_8-9_Hayeren_${stats.translatedCount}_ej.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'PDF ստեղծման սխալ։');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrintKatexPdf = () => {
    setIsPreparingPrint(true);
    setVisibleLimit(TOTAL_BOOK_PAGES);
    setTimeout(() => {
      setIsPreparingPrint(false);
      window.print();
    }, 350);
  };

  const handleDownloadWord = async () => {
    setIsExportingDocx(true);
    setExportError(null);
    try {
      const blob = await buildFullBookDocxBlob(pagesMap);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Galitsky_8-9_Hayeren_${stats.translatedCount}_ej.docx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Word (.docx) ստեղծման սխալ։');
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleDownloadHtml = () => {
    setIsExportingHtml(true);
    setExportError(null);
    setTimeout(() => {
      try {
        const html = buildFullBookHtmlDocument(pagesMap);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Galitsky_8-9_Hayeren_${stats.translatedCount}_ej.html`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } catch (err) {
        setExportError(err instanceof Error ? err.message : 'HTML ստեղծման սխալ։');
      } finally {
        setIsExportingHtml(false);
      }
    }, 30);
  };

  const handleDownloadMarkdown = () => {
    const md = buildCompiledBookMarkdown(pagesMap);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Galitsky_8-9_Hayeren_${stats.translatedCount}_ej.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8 print:p-0 print:bg-white print:overflow-visible">
      <div className="max-w-4xl mx-auto space-y-6 print:max-w-none print:space-y-4">
        {/* Top Export & Search Bar */}
        <section className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs no-print space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Ամբողջական հայերեն գիրք
              </h1>
              <p className="text-xs text-slate-500 mt-1 font-mono-tabular">
                Հավաքված է {stats.translatedCount} / {stats.totalPages} էջ ({stats.percentage}%)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleDownloadPdf()}
                disabled={isExportingPdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 transition-colors"
              >
                {isExportingPdf ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Ներբեռնել PDF</span>
              </button>

              <button
                type="button"
                onClick={() => void handleDownloadWord()}
                disabled={isExportingDocx}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60 transition-colors"
              >
                {isExportingDocx ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                <span>Ներբեռնել Word (.docx)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadHtml}
                disabled={isExportingHtml}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md border border-slate-300 text-slate-800 bg-white hover:bg-slate-50 disabled:opacity-60 transition-colors"
              >
                {isExportingHtml ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileCode2 className="w-3.5 h-3.5 text-sky-600" />
                )}
                <span>Ներբեռնել HTML</span>
              </button>

              <button
                type="button"
                onClick={handlePrintKatexPdf}
                disabled={isPreparingPrint}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-60"
              >
                {isPreparingPrint ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Printer className="w-3.5 h-3.5" />
                )}
                <span>Տպել</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-slate-200 text-slate-700 bg-white hover:bg-slate-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>.MD</span>
              </button>

              <button
                type="button"
                onClick={onOpenDriveModal}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-sky-200 text-sky-700 bg-sky-50 hover:bg-sky-100"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Google Drive</span>
              </button>
            </div>
          </div>

          {exportError && (
            <div role="alert" className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-800">
              {exportError}
            </div>
          )}

          {stats.remainingCount > 0 && (
            <div className="p-3 rounded-md bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
              <span>
                Գրքի ամբողջական ավարտի համար դեռ մնացել է թարգմանել{' '}
                <strong className="font-mono-tabular">{stats.remainingCount}</strong> էջ։
              </span>
              <button
                type="button"
                onClick={onSwitchToBatch}
                className="inline-flex items-center gap-1 text-sky-700 hover:text-sky-800 font-semibold"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Շարունակել թարգմանությունը</span>
              </button>
            </div>
          )}

          {/* Search inside compiled pages */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Որոնել թարգմանված տեքստում կամ խնդիրների համարներում..."
              aria-label="Որոնել թարգմանված տեքստում"
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-sky-500 focus:bg-white"
            />
          </div>
        </section>

        {/* Continuous Book Pages */}
        <div className="space-y-6 print:space-y-4">
          {displayedPages.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-sm text-slate-500">
              Որոնմանը համապատասխանող էջ չի գտնվել։
            </div>
          ) : (
            displayedPages.map((page) => (
              <article
                key={page.pageNumber}
                className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 shadow-xs print-page-break print:border-0 print:shadow-none print:p-4"
              >
                <div className="flex items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-200">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-xs font-mono-tabular font-bold text-sky-700">
                      Էջ {page.pageNumber}
                    </span>
                    <span className="text-xs text-slate-500">·</span>
                    <span className="text-xs font-medium text-slate-700">
                      {page.sectionTitle}
                    </span>
                  </div>
                  <div className="no-print flex items-center gap-2">
                    {page.model && (
                      <span
                        className={`text-[10px] font-mono-tabular px-2 py-0.5 rounded-full border ${getModelBadgeInfo(page.model).colorClass}`}
                        title={`Մոդել՝ ${getModelBadgeInfo(page.model).label}`}
                      >
                        {getModelBadgeInfo(page.model).shortLabel}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenPage(page.pageNumber)}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-sky-700"
                    >
                      <span>Բացել ընթերցիչում</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <MathRenderer content={page.translatedMarkdown} />
              </article>
            ))
          )}

          {!searchTerm.trim() && visibleLimit < orderedPages.length && (
            <div className="no-print flex flex-wrap items-center justify-center gap-3 py-4">
              <button
                type="button"
                onClick={() => setVisibleLimit((v) => v + 40)}
                className="px-4 py-2 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              >
                Ցույց տալ հաջորդ 40 էջերը ({displayedPages.length} / {orderedPages.length})
              </button>
              <button
                type="button"
                onClick={() => setVisibleLimit(TOTAL_BOOK_PAGES)}
                className="px-4 py-2 text-xs font-semibold rounded-md bg-sky-600 text-white hover:bg-sky-700"
              >
                Ցույց տալ բոլոր {orderedPages.length} էջերը
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
