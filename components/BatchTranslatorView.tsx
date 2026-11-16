'use client';

import React, { useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import {
  BOOK_SECTIONS,
  TOTAL_BOOK_PAGES,
  calculateProgressStats,
  getMissingPages,
  getSectionProgress,
  type TranslatedPage,
} from '@/lib/book-structure';

export interface BatchQueueState {
  isRunning: boolean;
  currentBatchPages: number[];
  completedInRun: number;
  targetTotalInRun: number;
  failedPages: number[];
  lastError: string | null;
}

interface BatchTranslatorViewProps {
  pagesMap: Record<number, TranslatedPage>;
  batchState: BatchQueueState;
  onStartQueue: (pagesToTranslate: number[]) => void;
  onStopQueue: () => void;
  onOpenPage: (page: number) => void;
  onExportJsonBackup: () => void;
  onImportJsonBackup: (file: File) => void;
}

export function BatchTranslatorView({
  pagesMap,
  batchState,
  onStartQueue,
  onStopQueue,
  onOpenPage,
  onExportJsonBackup,
  onImportJsonBackup,
}: BatchTranslatorViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stats = calculateProgressStats(pagesMap);
  const missingPages = getMissingPages(pagesMap);

  const handleStartFullBook = () => {
    if (missingPages.length > 0) {
      onStartQueue(missingPages);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Progress & Master Control Card */}
        <section className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Ամբողջ գրքի թարգմանության կառավարում (էջ 1–{TOTAL_BOOK_PAGES})
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Յուրաքանչյուր էջ թարգմանվում է առանձին՝ բոլոր մաթեմատիկական թվերը, արմատները, հավասարումները և պատասխանները անփոփոխ պահելով։
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {batchState.isRunning ? (
                <button
                  type="button"
                  onClick={onStopQueue}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                >
                  <Pause className="w-4 h-4" />
                  <span>Դադարեցնել թարգմանությունը</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartFullBook}
                  disabled={missingPages.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  <span>
                    {missingPages.length === 0
                      ? 'Ամբողջ գիրքը թարգմանված է'
                      : `Թարգմանել մնացած ${missingPages.length} էջերը`}
                  </span>
                </button>
              )}

              {batchState.failedPages.length > 0 && !batchState.isRunning && (
                <button
                  type="button"
                  onClick={() => onStartQueue(batchState.failedPages)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-slate-200 text-slate-700 bg-white hover:bg-slate-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Կրկնել չստացվածները ({batchState.failedPages.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-medium text-slate-700">
                Թարգմանության ընդհանուր առաջընթաց
              </span>
              <span className="font-mono-tabular font-semibold text-slate-900">
                {stats.translatedCount} / {stats.totalPages} էջ ({stats.percentage}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className="h-full bg-sky-600 transition-all duration-300"
                style={{ width: `${Math.min(100, stats.percentage)}%` }}
              />
            </div>
          </div>

          {/* Live Batch Status */}
          {batchState.isRunning && (
            <div className="mt-4 p-3 rounded-md bg-sky-50 border border-sky-200 text-xs text-sky-900 flex flex-wrap items-center justify-between gap-2">
              <span>
                Ընթացքում է՝ էջ {batchState.currentBatchPages.join(', ')} · Ավարտված է այս փուլում՝{' '}
                <strong className="font-mono-tabular">
                  {batchState.completedInRun} / {batchState.targetTotalInRun}
                </strong>
              </span>
              <span className="text-sky-700">
                Պահպանվում է ավտոմատ կերպով ձեր զննարկիչում
              </span>
            </div>
          )}

          {batchState.lastError && (
            <div
              role="alert"
              className="mt-4 p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{batchState.lastError}</span>
            </div>
          )}

          {/* Local JSON Backup & Restore */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <span>Պահուստային պատճեն (JSON)՝ աշխատանքը չկորցնելու համար</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onExportJsonBackup}
                className="px-2.5 py-1.5 rounded border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium"
              >
                Արտահանել JSON
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1.5 rounded border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium"
              >
                Ներմուծել JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImportJsonBackup(f);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
        </section>

        {/* Chapter-by-Chapter Matrix */}
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Գրքի բաժիններ և պարագրաֆներ
            </h2>
            <span className="text-xs font-mono-tabular text-slate-500">
              {BOOK_SECTIONS.length} բաժին
            </span>
          </div>

          <div className="divide-y divide-slate-200">
            {BOOK_SECTIONS.map((sec) => {
              const prog = getSectionProgress(sec, pagesMap);
              const isDone = prog.missingPages.length === 0;
              const pct = Math.round((prog.translated / prog.total) * 100);

              return (
                <div
                  key={sec.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold text-sky-700">
                        {sec.code}
                      </span>
                      <span className="text-xs font-mono-tabular text-slate-400">
                        էջ {sec.startPage}–{sec.endPage}
                      </span>
                      {isDone && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Ավարտված է</span>
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 mt-1">
                      {sec.titleHy}
                    </h3>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="w-40 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${isDone ? 'bg-emerald-600' : 'bg-sky-600'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono-tabular text-slate-500">
                        {prog.translated} / {prog.total} էջ ({pct}%)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenPage(sec.startPage)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 text-slate-700 bg-white hover:bg-slate-50"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Բացել</span>
                    </button>

                    {!isDone && (
                      <button
                        type="button"
                        disabled={batchState.isRunning}
                        onClick={() => onStartQueue(prog.missingPages)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Թարգմանել ({prog.missingPages.length})</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
