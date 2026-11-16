'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Search, CheckCircle2, Circle } from 'lucide-react';
import {
  BOOK_SECTIONS,
  TOTAL_BOOK_PAGES,
  getSectionProgress,
  validatePageNumber,
  type TranslatedPage,
} from '@/lib/book-structure';

interface TocSidebarProps {
  currentPage: number;
  pagesMap: Record<number, TranslatedPage>;
  onSelectPage: (page: number) => void;
  className?: string;
}

export function TocSidebar({
  currentPage,
  pagesMap,
  onSelectPage,
  className = '',
}: TocSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [jumpInput, setJumpInput] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'front-matter': true,
    'sec-1': true,
  });

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredSections = BOOK_SECTIONS.filter((sec) => {
    if (!normalizedQuery) return true;
    const matchMain =
      sec.code.toLowerCase().includes(normalizedQuery) ||
      sec.titleHy.toLowerCase().includes(normalizedQuery) ||
      sec.titleRu.toLowerCase().includes(normalizedQuery);
    const matchSub = sec.subsections?.some((sub) =>
      sub.titleHy.toLowerCase().includes(normalizedQuery)
    );
    return matchMain || Boolean(matchSub);
  });

  const toggleExpand = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(jumpInput.trim());
    if (!Number.isNaN(num) && jumpInput.trim() !== '') {
      onSelectPage(validatePageNumber(num));
      setJumpInput('');
    }
  };

  return (
    <aside
      aria-label="Գրքի բովանդակություն"
      className={`flex flex-col bg-white border-r border-slate-200 h-full overflow-hidden ${className}`}
    >
      <div className="p-3.5 border-b border-slate-200 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Բովանդակություն (1–{TOTAL_BOOK_PAGES})
          </h2>
        </div>

        {/* Search Sections */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Որոնել բաժին կամ թեմա..."
            aria-label="Որոնել բաժին կամ թեմա"
            className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white"
          />
        </div>

        {/* Jump to exact page */}
        <form onSubmit={handleJumpSubmit} className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            max={TOTAL_BOOK_PAGES}
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            placeholder="Էջի № (1–272)"
            aria-label="Անցնել էջի համարին"
            className="flex-1 min-w-0 px-2.5 py-1 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white"
          />
          <button
            type="submit"
            className="px-2.5 py-1 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            Գնալ
          </button>
        </form>
      </div>

      {/* Sections list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filteredSections.map((sec) => {
          const isCurrentSection =
            currentPage >= sec.startPage && currentPage <= sec.endPage;
          const progress = getSectionProgress(sec, pagesMap);
          const isComplete = progress.translated === progress.total;
          const hasSub = Boolean(sec.subsections && sec.subsections.length > 0);
          const isExpanded = Boolean(expandedSections[sec.id] || isCurrentSection || normalizedQuery);

          return (
            <div key={sec.id} className="rounded-md overflow-hidden">
              <div
                className={`flex items-start gap-1.5 px-2 py-2 rounded-md transition-colors ${
                  isCurrentSection
                    ? 'bg-sky-50 text-sky-900'
                    : 'hover:bg-slate-50 text-slate-800'
                }`}
              >
                {hasSub ? (
                  <button
                    type="button"
                    onClick={() => toggleExpand(sec.id)}
                    aria-expanded={isExpanded}
                    aria-label={`Բացել կամ փակել ${sec.code} ենթաբաժինները`}
                    className="mt-0.5 p-0.5 text-slate-400 hover:text-slate-700 shrink-0"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                ) : (
                  <span className="w-4.5 shrink-0" />
                )}

                <button
                  type="button"
                  onClick={() => onSelectPage(sec.startPage)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-sky-700">
                      {sec.code}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono-tabular text-slate-500 shrink-0">
                      {isComplete ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Circle className="w-2.5 h-2.5 text-slate-300" />
                      )}
                      {progress.translated}/{progress.total}
                    </span>
                  </div>
                  <div className="text-xs leading-snug font-medium text-slate-800 mt-0.5">
                    {sec.titleHy}
                  </div>
                  <div className="text-[11px] font-mono-tabular text-slate-400 mt-0.5">
                    էջ {sec.startPage}–{sec.endPage}
                  </div>
                </button>
              </div>

              {hasSub && isExpanded && (
                <div className="ml-6 pl-2 border-l border-slate-200 my-1 space-y-0.5">
                  {sec.subsections!.map((sub, idx) => {
                    const isSubActive = currentPage === sub.page;
                    return (
                      <button
                        key={`${sec.id}-sub-${idx}`}
                        type="button"
                        onClick={() => onSelectPage(sub.page)}
                        className={`w-full text-left px-2 py-1 rounded text-[11px] leading-snug flex items-center justify-between gap-2 transition-colors ${
                          isSubActive
                            ? 'bg-sky-100 text-sky-900 font-semibold'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <span className="truncate">{sub.titleHy}</span>
                        <span className="font-mono-tabular text-slate-400 shrink-0">
                          {sub.page}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
