'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, BookOpen, Sparkles, CheckCircle2 } from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  BOOK_SECTIONS,
  TOTAL_BOOK_PAGES,
  calculateProgressStats,
  getSectionForPage,
  getSectionProgress,
  validatePageNumber,
  type TranslatedPage,
} from '@/lib/book-structure';
import { SEED_TRANSLATIONS } from '@/lib/seed-translations';
import {
  exportBookJson,
  loadAllPages,
  parseImportedBookJson,
  savePage,
  savePagesBatch,
} from '@/lib/storage';
import { getCachedDriveToken, subscribeAuth } from '@/lib/google-auth';
import { TopHeader, type WorkspaceTab } from '@/components/TopHeader';
import { TocSidebar } from '@/components/TocSidebar';
import { PageWorkspace } from '@/components/PageWorkspace';
import {
  BatchTranslatorView,
  type BatchQueueState,
} from '@/components/BatchTranslatorView';
import { CompiledBookView } from '@/components/CompiledBookView';
import { DriveExportModal } from '@/components/DriveExportModal';

interface BookStudioClientProps {
  initialPage: number;
  initialView: WorkspaceTab;
}

export function BookStudioClient({
  initialPage,
  initialView,
}: BookStudioClientProps) {
  const [pagesMap, setPagesMap] = useState<Record<number, TranslatedPage>>(
    () => ({ ...SEED_TRANSLATIONS })
  );
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialView);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [driveModalOpen, setDriveModalOpen] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [driveTokenVersion, setDriveTokenVersion] = useState(0);
  const [isSingleTranslating, setIsSingleTranslating] = useState(false);
  const [singleError, setSingleError] = useState<string | null>(null);

  const [batchState, setBatchState] = useState<BatchQueueState>({
    isRunning: false,
    currentBatchPages: [],
    completedInRun: 0,
    targetTotalInRun: 0,
    failedPages: [],
    lastError: null,
  });

  const batchStopRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    loadAllPages().then((loaded) => {
      if (mounted) {
        setPagesMap(loaded);
      }
    });

    const unsubscribe = subscribeAuth((authUser) => {
      setUser(authUser);
      setDriveTokenVersion((v) => v + 1);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const handleSelectPage = useCallback((page: number) => {
    const safePage = validatePageNumber(page);
    setCurrentPage(safePage);
    setActiveTab('reader');
    setMobileTocOpen(false);
    setSingleError(null);
  }, []);

  const handleTranslateSinglePage = useCallback(async (pageNumber: number, model?: string) => {
    const safePage = validatePageNumber(pageNumber);
    setIsSingleTranslating(true);
    setSingleError(null);

    try {
      const res = await fetch('/api/translate-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: safePage,
          model: model && model !== 'auto' ? model : undefined,
          forceModel: Boolean(model && model !== 'auto'),
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        pages?: { pageNumber: number; sectionTitle: string; translatedMarkdown: string; model?: string }[];
        modelUsed?: string;
      };

      if (!res.ok || !data.pages || data.pages.length === 0) {
        throw new Error(data.error || `Սերվերի սխալ (${res.status})`);
      }

      const item = data.pages[0];
      const translated: TranslatedPage = {
        pageNumber: item.pageNumber,
        sectionTitle: item.sectionTitle,
        translatedMarkdown: item.translatedMarkdown,
        source: 'gemini',
        model: item.model || data.modelUsed,
        updatedAt: new Date().toISOString(),
      };

      await savePage(translated);
      setPagesMap((prev) => ({
        ...prev,
        [translated.pageNumber]: translated,
      }));
    } catch (err) {
      setSingleError(
        err instanceof Error ? err.message : 'Չհաջողվեց թարգմանել էջը։'
      );
    } finally {
      setIsSingleTranslating(false);
    }
  }, []);

  const handleSaveEditedPage = useCallback(
    async (pageNumber: number, newMarkdown: string, newTitle: string) => {
      const safePage = validatePageNumber(pageNumber);
      const section = getSectionForPage(safePage);
      const updated: TranslatedPage = {
        pageNumber: safePage,
        sectionTitle: newTitle.trim() || `${section.code}. ${section.titleHy}`,
        translatedMarkdown: newMarkdown,
        source: 'edited',
        model: 'edited',
        updatedAt: new Date().toISOString(),
      };
      await savePage(updated);
      setPagesMap((prev) => ({
        ...prev,
        [safePage]: updated,
      }));
    },
    []
  );

  const handleStartQueue = useCallback(async (queueInput: number[], modelOverride?: string) => {
    const uniqueQueue = Array.from(new Set(queueInput))
      .map((p) => validatePageNumber(p))
      .sort((a, b) => a - b);

    if (uniqueQueue.length === 0) return;

    batchStopRef.current = false;
    setActiveTab('batch');
    setBatchState({
      isRunning: true,
      currentBatchPages: [],
      completedInRun: 0,
      targetTotalInRun: uniqueQueue.length,
      failedPages: [],
      lastError: null,
    });

    const batchSize = 2;
    let completed = 0;
    const failed: number[] = [];

    for (let i = 0; i < uniqueQueue.length; i += batchSize) {
      if (batchStopRef.current) break;

      const slice = uniqueQueue.slice(i, i + batchSize);
      setBatchState((prev) => ({
        ...prev,
        currentBatchPages: slice,
      }));

      try {
        const res = await fetch('/api/translate-page', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pages: slice,
            model: modelOverride && modelOverride !== 'auto' ? modelOverride : undefined,
          }),
        });

        const data = (await res.json()) as {
          error?: string;
          pages?: { pageNumber: number; sectionTitle: string; translatedMarkdown: string; model?: string }[];
          modelUsed?: string;
        };

        if (!res.ok || !data.pages) {
          throw new Error(data.error || `Սխալ էջեր ${slice.join(', ')}-ում`);
        }

        const now = new Date().toISOString();
        const savedBatch: TranslatedPage[] = data.pages.map((item) => ({
          pageNumber: item.pageNumber,
          sectionTitle: item.sectionTitle,
          translatedMarkdown: item.translatedMarkdown,
          source: 'gemini',
          model: item.model || data.modelUsed,
          updatedAt: now,
        }));

        await savePagesBatch(savedBatch);
        completed += savedBatch.length;

        setPagesMap((prev) => {
          const next = { ...prev };
          for (const p of savedBatch) {
            next[p.pageNumber] = p;
          }
          return next;
        });

        setBatchState((prev) => ({
          ...prev,
          completedInRun: completed,
        }));
      } catch (err) {
        failed.push(...slice);
        const msg = err instanceof Error ? err.message : 'Թարգմանության սխալ';
        setBatchState((prev) => ({
          ...prev,
          failedPages: [...failed],
          lastError: msg,
        }));
      }
    }

    setBatchState((prev) => ({
      ...prev,
      isRunning: false,
      currentBatchPages: [],
    }));
  }, []);

  const handleVerifyFullBook = useCallback(async (modelOverride?: string) => {
    batchStopRef.current = false;
    setActiveTab('batch');
    setBatchState({
      isRunning: true,
      currentBatchPages: [],
      completedInRun: 0,
      targetTotalInRun: TOTAL_BOOK_PAGES,
      failedPages: [],
      lastError: null,
    });

    let completed = 0;
    const allPages: number[] = [];
    for (let p = 1; p <= TOTAL_BOOK_PAGES; p++) {
      allPages.push(p);
    }

    const batchSize = 4;
    for (let i = 0; i < allPages.length; i += batchSize) {
      if (batchStopRef.current) break;
      const slice = allPages.slice(i, i + batchSize);
      setBatchState((prev) => ({ ...prev, currentBatchPages: slice }));

      try {
        const res = await fetch('/api/verify-book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pages: slice, model: modelOverride }),
        });
        const data = (await res.json()) as {
          error?: string;
          verifiedPages?: { pageNumber: number; improvedMarkdown: string; accuracyScore: number; modelUsed: string }[];
        };

        if (!res.ok || !data.verifiedPages) {
          throw new Error(data.error || 'Ստուգման սխալ');
        }

        const now = new Date().toISOString();
        const savedBatch: TranslatedPage[] = data.verifiedPages.map((item) => {
          const old = pagesMap[item.pageNumber];
          const section = getSectionForPage(item.pageNumber);
          return {
            pageNumber: item.pageNumber,
            sectionTitle: old?.sectionTitle || `${section.code}. ${section.titleHy}`,
            translatedMarkdown: item.improvedMarkdown,
            source: 'gemini',
            model: item.modelUsed,
            updatedAt: now,
          };
        });

        await savePagesBatch(savedBatch);
        completed += savedBatch.length;

        setPagesMap((prev) => {
          const next = { ...prev };
          for (const p of savedBatch) {
            next[p.pageNumber] = p;
          }
          return next;
        });

        setBatchState((prev) => ({ ...prev, completedInRun: completed }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Ստուգման սխալ';
        setBatchState((prev) => ({ ...prev, lastError: msg }));
      }
    }

    setBatchState((prev) => ({ ...prev, isRunning: false, currentBatchPages: [] }));
  }, [pagesMap]);

  const handleStopQueue = useCallback(() => {
    batchStopRef.current = true;
    setBatchState((prev) => ({
      ...prev,
      isRunning: false,
    }));
  }, []);

  const handleTranslateSectionFromReader = useCallback(
    (startPage: number, endPage: number) => {
      const missingInSection: number[] = [];
      for (let p = startPage; p <= endPage; p++) {
        if (!pagesMap[p]?.translatedMarkdown?.trim()) {
          missingInSection.push(p);
        }
      }
      if (missingInSection.length === 0) {
        setActiveTab('batch');
        return;
      }
      void handleStartQueue(missingInSection);
    },
    [pagesMap, handleStartQueue]
  );

  const handleExportJsonBackup = useCallback(() => {
    const json = exportBookJson(pagesMap);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Galitsky_8-9_Hayeren_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, [pagesMap]);

  const handleImportJsonBackup = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const imported = parseImportedBookJson(text);
      if (imported.length === 0) return;
      await savePagesBatch(imported);
      setPagesMap((prev) => {
        const next = { ...prev };
        for (const p of imported) {
          next[p.pageNumber] = p;
        }
        return next;
      });
    } catch {
      setBatchState((prev) => ({
        ...prev,
        lastError: 'Չհաջողվեց կարդալ JSON պահուստային ֆայլը։',
      }));
    }
  }, []);

  const stats = calculateProgressStats(pagesMap);
  const driveConnected = Boolean(driveTokenVersion >= 0 && user && getCachedDriveToken());

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      <TopHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenDriveModal={() => setDriveModalOpen(true)}
        onOpenMobileToc={() => setMobileTocOpen(true)}
        translatedCount={stats.translatedCount}
        totalPages={TOTAL_BOOK_PAGES}
        driveConnected={driveConnected}
      />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Desktop Persistent TOC Sidebar */}
        {activeTab === 'reader' && (
          <div className="hidden lg:block w-80 shrink-0 h-full">
            <TocSidebar
              currentPage={currentPage}
              pagesMap={pagesMap}
              onSelectPage={handleSelectPage}
            />
          </div>
        )}

        {/* Mobile Slide-Over TOC Drawer */}
        {mobileTocOpen && (
          <div className="fixed inset-0 z-40 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/40"
              onClick={() => setMobileTocOpen(false)}
              aria-hidden="true"
            />
            <div className="relative z-10 w-80 max-w-[85vw] h-full bg-white shadow-xl flex flex-col">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">
                  Բովանդակություն
                </span>
                <button
                  type="button"
                  onClick={() => setMobileTocOpen(false)}
                  aria-label="Փակել բովանդակությունը"
                  className="p-1 text-slate-500 hover:text-slate-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <TocSidebar
                  currentPage={currentPage}
                  pagesMap={pagesMap}
                  onSelectPage={handleSelectPage}
                />
              </div>
            </div>
          </div>
        )}

        {/* Active Workspace View */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'reader' && (
            <PageWorkspace
              currentPage={currentPage}
              pageData={pagesMap[currentPage]}
              isTranslating={isSingleTranslating}
              translationError={singleError}
              onSelectPage={handleSelectPage}
              onTranslatePage={handleTranslateSinglePage}
              onTranslateSection={handleTranslateSectionFromReader}
              onSaveEditedPage={handleSaveEditedPage}
              onOpenCompiled={() => setActiveTab('compiled')}
            />
          )}

          {activeTab === 'toc' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50">
              <div className="max-w-5xl mx-auto space-y-6">
                <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs">
                  <h1 className="text-xl font-bold text-slate-900">
                    Գրքի ամբողջական բովանդակություն (Մ. Լ. Գալիցկի, Ա. Մ. Գոլդման, Լ. Ի. Զվավիչ)
                  </h1>
                  <p className="text-sm text-slate-600 mt-1">
                    Ընտրեք ցանկացած պարագրաֆ կամ ենթաբաժին՝ էջերը կարդալու, համեմատելու և հայերեն թարգմանելու համար։
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {BOOK_SECTIONS.map((sec) => {
                    const prog = getSectionProgress(sec, pagesMap);
                    const done = prog.missingPages.length === 0;

                    return (
                      <article
                        key={sec.id}
                        className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between gap-4 shadow-xs"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-sky-700">
                              {sec.code}
                            </span>
                            <span className="text-xs font-mono-tabular text-slate-500">
                              էջ {sec.startPage}–{sec.endPage} · {prog.translated}/{prog.total}
                            </span>
                          </div>
                          <h2 className="text-base font-bold text-slate-900 mt-1.5">
                            {sec.titleHy}
                          </h2>
                          {sec.subsections && sec.subsections.length > 0 && (
                            <ul className="mt-3 space-y-1 text-xs text-slate-600">
                              {sec.subsections.map((sub, i) => (
                                <li key={i} className="flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectPage(sub.page)}
                                    className="text-left hover:text-sky-700 hover:underline truncate"
                                  >
                                    {sub.titleHy}
                                  </button>
                                  <span className="font-mono-tabular text-slate-400 shrink-0">
                                    {sub.page}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectPage(sec.startPage)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Կարդալ էջ {sec.startPage}-ից</span>
                          </button>

                          {done ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Ավարտված է</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={batchState.isRunning}
                              onClick={() => void handleStartQueue(prog.missingPages)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Թարգմանել ({prog.missingPages.length} էջ)</span>
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'batch' && (
            <BatchTranslatorView
              pagesMap={pagesMap}
              batchState={batchState}
              onStartQueue={handleStartQueue}
              onVerifyFullBook={handleVerifyFullBook}
              onStopQueue={handleStopQueue}
              onOpenPage={handleSelectPage}
              onExportJsonBackup={handleExportJsonBackup}
              onImportJsonBackup={handleImportJsonBackup}
            />
          )}

          {activeTab === 'compiled' && (
            <CompiledBookView
              pagesMap={pagesMap}
              onOpenPage={handleSelectPage}
              onOpenDriveModal={() => setDriveModalOpen(true)}
              onSwitchToBatch={() => setActiveTab('batch')}
            />
          )}
        </main>
      </div>

      <DriveExportModal
        isOpen={driveModalOpen}
        onClose={() => setDriveModalOpen(false)}
        user={user}
        pagesMap={pagesMap}
        onTokenChanged={() => setDriveTokenVersion((v) => v + 1)}
      />
    </div>
  );
}
