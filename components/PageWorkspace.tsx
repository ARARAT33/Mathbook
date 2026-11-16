'use client';

import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RotateCw,
  Pencil,
  Check,
  X,
  Eye,
  EyeOff,
  FileText,
  ExternalLink,
  AlertCircle,
  Download,
  SearchCheck,
  Cpu,
  ChevronDown,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  TOTAL_BOOK_PAGES,
  getSectionForPage,
  validatePageNumber,
  TRANSLATION_MODELS,
  getModelBadgeInfo,
  type TranslatedPage,
} from '@/lib/book-structure';
import { MathRenderer } from './MathRenderer';
import { PdfPageViewer } from './PdfPageViewer';
import { PageComparisonModal } from './PageComparisonModal';

interface PageWorkspaceProps {
  currentPage: number;
  pageData: TranslatedPage | undefined;
  isTranslating: boolean;
  translationError: string | null;
  onSelectPage: (page: number) => void;
  onTranslatePage: (page: number, model?: string) => Promise<void>;
  onTranslateSection: (startPage: number, endPage: number, model?: string) => void;
  onSaveEditedPage: (pageNumber: number, newMarkdown: string, newTitle: string) => Promise<void>;
  onOpenCompiled: () => void;
}

export function PageWorkspace({
  currentPage,
  pageData,
  isTranslating,
  translationError,
  onSelectPage,
  onTranslatePage,
  onTranslateSection,
  onSaveEditedPage,
  onOpenCompiled,
}: PageWorkspaceProps) {
  const [showOriginalPdf, setShowOriginalPdf] = useState(true);
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [draftMarkdown, setDraftMarkdown] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftPageInput, setDraftPageInput] = useState<{ page: number; value: string } | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('auto');
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);

  const section = getSectionForPage(currentPage);
  const isEditing = editingPage === currentPage;
  const pageInput =
    draftPageInput?.page === currentPage ? draftPageInput.value : String(currentPage);

  const handleOpenEdit = () => {
    setDraftTitle(pageData?.sectionTitle || `${section.code}. ${section.titleHy}`);
    setDraftMarkdown(pageData?.translatedMarkdown || '');
    setEditingPage(currentPage);
  };

  const handleSaveEdit = async () => {
    if (!draftMarkdown.trim()) return;
    setIsSavingEdit(true);
    try {
      await onSaveEditedPage(currentPage, draftMarkdown, draftTitle);
      setEditingPage(null);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handlePageJump = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(pageInput);
    if (!Number.isNaN(num)) {
      onSelectPage(validatePageNumber(num));
    }
  };

  const pdfUrl = `/api/pdf-page?page=${currentPage}`;
  const modelBadge = getModelBadgeInfo(
    pageData?.model || (pageData?.source === 'seed' ? 'seed' : pageData?.source === 'edited' ? 'edited' : undefined)
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Page Workspace Toolbar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Navigation & Section info */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => onSelectPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            aria-label="Նախորդ էջ"
            className="p-1.5 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <form onSubmit={handlePageJump} className="flex items-center gap-1.5">
            <label htmlFor="reader-page-input" className="text-xs text-slate-500">
              Էջ
            </label>
            <input
              id="reader-page-input"
              type="number"
              min={1}
              max={TOTAL_BOOK_PAGES}
              value={pageInput}
              onChange={(e) =>
                setDraftPageInput({ page: currentPage, value: e.target.value })
              }
              className="w-14 px-2 py-1 text-xs font-mono-tabular text-center border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:border-sky-500 focus:bg-white"
            />
            <span className="text-xs font-mono-tabular text-slate-400">
              / {TOTAL_BOOK_PAGES}
            </span>
          </form>

          <button
            type="button"
            onClick={() => onSelectPage(Math.min(TOTAL_BOOK_PAGES, currentPage + 1))}
            disabled={currentPage >= TOTAL_BOOK_PAGES}
            aria-label="Հաջորդ էջ"
            className="p-1.5 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="hidden md:flex items-center gap-2 ml-2 text-xs text-slate-500 truncate">
            <span className="font-semibold text-slate-700">{section.code}</span>
            <span>·</span>
            <span className="truncate max-w-xs">{section.titleHy}</span>
          </div>
        </div>

        {/* Action Controls & Model Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Model Selector Dropdown */}
          <div className="relative flex items-center">
            <Cpu className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              aria-label="Ընտրել AI թարգմանության մոդելը"
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md pl-7 pr-7 py-1.5 text-xs font-medium text-slate-800 shadow-2xs focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              {TRANSLATION_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.shortLabel}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={onOpenCompiled}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-slate-300 text-slate-800 bg-white hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-sky-600" />
            <span>PDF · Word · HTML</span>
          </button>

          <button
            type="button"
            onClick={() => setShowOriginalPdf((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 shadow-2xs"
          >
            {showOriginalPdf ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showOriginalPdf ? 'Թաքցնել բնօրինակը' : 'Ցույց տալ բնօրինակ PDF-ը'}</span>
          </button>

          {/* Line-by-line verification comparison tool button */}
          <button
            type="button"
            onClick={() => setIsComparisonModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-indigo-200 bg-indigo-50/60 text-indigo-700 hover:bg-indigo-100 transition-colors whitespace-nowrap shrink-0 shadow-2xs"
            title="Տող առ տող մանրամասն համեմատել բնօրինակի հետ"
          >
            <SearchCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Տող առ տող ստուգել</span>
          </button>

          {pageData && !isEditing && (
            <button
              type="button"
              onClick={handleOpenEdit}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 shadow-2xs"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Խմբագրել</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onTranslatePage(currentPage, selectedModel)}
            disabled={isTranslating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 shadow-2xs"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isTranslating ? 'animate-spin' : ''}`} />
            <span>
              {isTranslating
                ? 'Թարգմանվում է...'
                : pageData
                  ? 'Վերաթարգմանել'
                  : 'Թարգմանել այս էջը'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Split Reading Canvas */}
      <div
        className={`flex-1 overflow-y-auto xl:overflow-hidden grid grid-cols-1 ${
          showOriginalPdf ? 'xl:grid-cols-2' : ''
        } gap-4 p-4`}
      >
        {/* Left Pane: Original Russian PDF Page */}
        {showOriginalPdf && (
          <section
            aria-label={`Բնօրինակ ռուսերեն էջ ${currentPage}`}
            className="flex flex-col bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs min-h-[420px] xl:h-full"
          >
            <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 min-w-0">
                <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">Բնօրինակ PDF · Էջ {currentPage} (Ռուսերեն)</span>
              </div>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 font-medium whitespace-nowrap shrink-0"
              >
                <span>Բացել առանձին</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <PdfPageViewer page={currentPage} />
          </section>
        )}

        {/* Right Pane: Armenian Typeset Textbook Sheet */}
        <section
          aria-label={`Հայերեն թարգմանված էջ ${currentPage}`}
          className="flex flex-col bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs min-h-[420px] xl:h-full"
        >
          <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-slate-800 truncate">
              Հայերեն թարգմանություն · Էջ {currentPage}
            </div>
            {pageData && (
              <span
                className={`text-[11px] font-mono-tabular px-2.5 py-0.5 rounded-full border shrink-0 font-medium ${modelBadge.colorClass}`}
                title={`Մոդել՝ ${modelBadge.label}`}
              >
                {modelBadge.label}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6 sm:p-8">
            {translationError && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <div>
                  <p className="font-semibold">Թարգմանության սխալ</p>
                  <p className="mt-0.5">{translationError}</p>
                </div>
              </div>
            )}

            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="edit-page-title"
                    className="block text-xs font-medium text-slate-600 mb-1"
                  >
                    Էջի վերնագիր
                  </label>
                  <input
                    id="edit-page-title"
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-page-markdown"
                    className="block text-xs font-medium text-slate-600 mb-1"
                  >
                    Տեքստ (Markdown և LaTeX՝ $...$, $$...$$)
                  </label>
                  <textarea
                    id="edit-page-markdown"
                    rows={16}
                    value={draftMarkdown}
                    onChange={(e) => setDraftMarkdown(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:border-sky-500 leading-relaxed"
                  />
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingPage(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Չեղարկել</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit || !draftMarkdown.trim()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSavingEdit ? 'Պահպանվում է...' : 'Պահպանել փոփոխությունը'}</span>
                  </button>
                </div>
              </div>
            ) : isTranslating ? (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center px-6">
                <RotateCw className="w-7 h-7 text-sky-600 animate-spin mb-3" />
                <p className="text-sm font-semibold text-slate-900">
                  Կատարվում է էջ {currentPage}-ի ճշգրիտ հայերեն թարգմանություն...
                </p>
                <p className="text-xs text-slate-500 mt-1.5 max-w-md">
                  Պահպանվում են բոլոր թվերը, փոփոխականները, հավասարումները, արմատներն ու բանաձևերը LaTeX ձևաչափով։
                </p>
              </div>
            ) : pageData ? (
              <motion.article
                key={currentPage}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
              >
                <div className="flex items-center justify-between text-xs font-medium text-sky-700 mb-3 pb-2 border-b border-slate-100">
                  <span>{pageData.sectionTitle}</span>
                  <button
                    type="button"
                    onClick={() => setIsComparisonModalOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    <SearchCheck className="w-3.5 h-3.5" />
                    <span>Ստուգել բնօրինակի հետ</span>
                  </button>
                </div>
                <MathRenderer content={pageData.translatedMarkdown} />
              </motion.article>
            ) : (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center px-6">
                <div className="w-11 h-11 rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center mb-3">
                  <Sparkles className="w-5 h-5 text-sky-600" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  Էջ {currentPage}-ը դեռ թարգմանված չէ
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 max-w-md leading-relaxed">
                  Բնօրինակ էջը ցուցադրված է ձախ կողմում։ Սեղմեք ստորև բերված կոճակը՝ այս էջը ճշգրիտ հայերեն թարգմանելու և բանաձևերը պահպանելու համար։
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onTranslatePage(currentPage, selectedModel)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-xs"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Թարգմանել էջ {currentPage}-ը</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenEdit}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-md border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-xs"
                  >
                    <Pencil className="w-4 h-4" />
                    <span>Մուտքագրել ձեռքով</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Line-by-Line Detailed Comparison Modal */}
      <PageComparisonModal
        isOpen={isComparisonModalOpen}
        onClose={() => setIsComparisonModalOpen(false)}
        pageNumber={currentPage}
        pageData={pageData}
        onApplyImprovedMarkdown={async (p, md) => {
          await onSaveEditedPage(p, md, pageData?.sectionTitle || `${section.code}. ${section.titleHy}`);
        }}
        onRetranslateWithModel={async (p, modelId) => {
          await onTranslatePage(p, modelId);
        }}
      />
    </div>
  );
}
