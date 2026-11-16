'use client';

import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCw,
  Sparkles,
  ArrowRight,
  Check,
  Cpu,
  Layers,
  ChevronDown,
} from 'lucide-react';
import {
  TRANSLATION_MODELS,
  getModelBadgeInfo,
  type TranslatedPage,
} from '@/lib/book-structure';
import { MathRenderer } from './MathRenderer';

export interface LineComparisonItem {
  lineNumber?: number;
  itemLabel: string;
  originalRu: string;
  translationHy: string;
  status: 'match' | 'minor_difference' | 'formula_error' | 'missing';
  comment?: string;
}

export interface SuggestedCorrection {
  location: string;
  currentText: string;
  suggestedText: string;
  reason: string;
}

export interface VerificationResult {
  pageNumber: number;
  accuracyScore: number;
  overallStatus: 'exact_match' | 'minor_differences' | 'needs_attention';
  summaryHy: string;
  lineComparisons: LineComparisonItem[];
  suggestedCorrections?: SuggestedCorrection[];
  improvedMarkdown?: string;
}

interface PageComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageNumber: number;
  pageData?: TranslatedPage;
  onApplyImprovedMarkdown?: (pageNumber: number, markdown: string) => Promise<void>;
  onRetranslateWithModel?: (pageNumber: number, modelId: string) => Promise<void>;
}

export function PageComparisonModal({
  isOpen,
  onClose,
  pageNumber,
  pageData,
  onApplyImprovedMarkdown,
  onRetranslateWithModel,
}: PageComparisonModalProps) {
  const [selectedModel, setSelectedModel] = useState<string>('auto');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRetranslating, setIsRetranslating] = useState(false);
  const [isApplyingCorrection, setIsApplyingCorrection] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [verifiedModelUsed, setVerifiedModelUsed] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'lines' | 'corrections' | 'preview'>('lines');
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  if (!isOpen) return null;

  const currentBadge = getModelBadgeInfo(pageData?.model);

  const handleRunVerification = async () => {
    setIsVerifying(true);
    setErrorMsg(null);
    setAppliedSuccess(false);

    try {
      const res = await fetch('/api/verify-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: pageNumber,
          markdown: pageData?.translatedMarkdown || '',
          model: selectedModel,
          forceModel: selectedModel !== 'auto',
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        verification?: VerificationResult;
        modelUsed?: string;
      };

      if (!res.ok || !data.verification) {
        throw new Error(data.error || `Ստուգումը չհաջողվեց (HTTP ${res.status})`);
      }

      setVerificationResult(data.verification);
      setVerifiedModelUsed(data.modelUsed || selectedModel);
      if (
        data.verification.suggestedCorrections &&
        data.verification.suggestedCorrections.length > 0 &&
        data.verification.accuracyScore < 95
      ) {
        setActiveTab('corrections');
      } else {
        setActiveTab('lines');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Անհայտ սխալ ստուգման ժամանակ'
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRetranslate = async () => {
    if (!onRetranslateWithModel) return;
    setIsRetranslating(true);
    setErrorMsg(null);
    try {
      await onRetranslateWithModel(pageNumber, selectedModel);
      // After re-translation, clear previous verification and prompt to verify new content
      setVerificationResult(null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Չհաջողվեց վերաթարգմանել'
      );
    } finally {
      setIsRetranslating(false);
    }
  };

  const handleApplyCorrections = async () => {
    if (!verificationResult?.improvedMarkdown || !onApplyImprovedMarkdown) return;
    setIsApplyingCorrection(true);
    try {
      await onApplyImprovedMarkdown(
        pageNumber,
        verificationResult.improvedMarkdown
      );
      setAppliedSuccess(true);
      setTimeout(() => setAppliedSuccess(false), 4000);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Չհաջողվեց կիրառել շտկումները'
      );
    } finally {
      setIsApplyingCorrection(false);
    }
  };

  const verifiedBadge = getModelBadgeInfo(verifiedModelUsed || undefined);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="comparison-modal-title"
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">
              {pageNumber}
            </div>
            <div>
              <h2
                id="comparison-modal-title"
                className="text-base font-bold text-slate-900 flex items-center gap-2"
              >
                <span>Տող առ տող համեմատական ստուգում բնօրինակի հետ</span>
              </h2>
              <p className="text-xs text-slate-500">
                Մ. Լ. Գալիցկի — Հանրահաշվի խնդրագիրք · Էջ {pageNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {pageData?.model && (
              <span
                className={`text-xs px-2.5 py-1 rounded-full border font-medium ${currentBadge.colorClass}`}
                title={`Թարգմանված է՝ ${currentBadge.label}`}
              >
                Ընթացիկ՝ {currentBadge.shortLabel}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Փակել պատուհանը"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Model Selection & Action Toolbar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-slate-500" />
              <span>Մոդել՝</span>
            </span>

            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="appearance-none bg-white border border-slate-300 rounded-md pl-3 pr-8 py-1.5 text-xs font-medium text-slate-800 shadow-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 cursor-pointer"
              >
                {TRANSLATION_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.labelHy}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <span className="text-[11px] text-slate-500 hidden sm:inline">
              (Սպառվելիս ավտոմատ կանցնի հաջորդին)
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onRetranslateWithModel && (
              <button
                type="button"
                onClick={handleRetranslate}
                disabled={isRetranslating || isVerifying}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-xs"
                title="Վերաթարգմանել էջը ընտրված մոդելով"
              >
                <RotateCw
                  className={`w-3.5 h-3.5 text-slate-500 ${
                    isRetranslating ? 'animate-spin' : ''
                  }`}
                />
                <span>{isRetranslating ? 'Թարգմանվում է...' : 'Վերաթարգմանել այս մոդելով'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleRunVerification}
              disabled={isVerifying || isRetranslating}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 transition-colors shadow-xs"
            >
              <Sparkles
                className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`}
              />
              <span>
                {isVerifying
                  ? 'Համեմատվում է տող առ տող...'
                  : verificationResult
                  ? 'Կրկին համեմատել'
                  : 'Ստուգել տող առ տող'}
              </span>
            </button>
          </div>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Սխալ՝ </span>
              {errorMsg}
            </div>
          </div>
        )}

        {/* Success applied banner */}
        {appliedSuccess && (
          <div className="mx-6 mt-4 p-3 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Առաջարկված շտկումները հաջողությամբ կիրառվեցին և պահպանվեցին։</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {!verificationResult && !isVerifying && (
            <div className="text-center py-12 px-4 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center mx-auto mb-3">
                <Layers className="w-6 h-6 text-sky-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                Մանրամասն տող առ տող ստուգում
              </h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Այս գործիքը կուղարկի էջ {pageNumber}-ի ռուսերեն PDF բնօրինակը և հայերեն թարգմանությունը AI մոդելին (Gemini 4 Hydrogen / Pro / Flash)՝
                ստուգելու յուրաքանչյուր խնդրի համար, ենթակետ, բանաձև, թիվ և տեքստային պահանջ։
              </p>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={handleRunVerification}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-sky-600 text-white hover:bg-sky-700 shadow-xs transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Սկսել ստուգումը հիմա</span>
                </button>
              </div>
            </div>
          )}

          {isVerifying && (
            <div className="text-center py-14">
              <RotateCw className="w-8 h-8 text-sky-600 animate-spin mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-900">
                Կատարվում է մաթեմատիկական խորը տող առ տող ստուգում...
              </p>
              <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto">
                Մոդելը համեմատում է ռուսերեն PDF-ի բոլոր հավասարումները, արմատները, ցուցիչներն ու համարները հայերենի հետ։
              </p>
            </div>
          )}

          {verificationResult && !isVerifying && (
            <>
              {/* Summary Score Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center shrink-0 ${
                      verificationResult.accuracyScore >= 95
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : verificationResult.accuracyScore >= 80
                        ? 'border-amber-500 bg-amber-50 text-amber-800'
                        : 'border-rose-500 bg-rose-50 text-rose-800'
                    }`}
                  >
                    <span className="text-lg font-extrabold font-mono-tabular leading-tight">
                      {verificationResult.accuracyScore}%
                    </span>
                    <span className="text-[9px] font-medium uppercase tracking-wide">
                      Ճշգրտություն
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900">
                        {verificationResult.overallStatus === 'exact_match'
                          ? '✓ Կատարյալ համապատասխանություն'
                          : verificationResult.overallStatus === 'minor_differences'
                          ? '⚠️ Փոքր անճշտություններ'
                          : '❌ Պահանջվում է ուշադրություն'}
                      </span>
                      {verifiedModelUsed && (
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${verifiedBadge.colorClass}`}
                        >
                          Ստուգվել է՝ {verifiedBadge.shortLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                      {verificationResult.summaryHy}
                    </p>
                  </div>
                </div>

                {verificationResult.suggestedCorrections &&
                  verificationResult.suggestedCorrections.length > 0 &&
                  verificationResult.improvedMarkdown && (
                    <button
                      type="button"
                      onClick={handleApplyCorrections}
                      disabled={isApplyingCorrection}
                      className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {isApplyingCorrection
                          ? 'Կիրառվում է...'
                          : 'Կիրառել առաջարկված շտկումները'}
                      </span>
                    </button>
                  )}
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('lines')}
                  className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${
                    activeTab === 'lines'
                      ? 'border-sky-600 text-sky-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Տող առ տող համեմատություն ({verificationResult.lineComparisons.length})
                </button>

                {verificationResult.suggestedCorrections &&
                  verificationResult.suggestedCorrections.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('corrections')}
                      className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                        activeTab === 'corrections'
                          ? 'border-sky-600 text-sky-700'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <span>Շտկման առաջարկներ</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px]">
                        {verificationResult.suggestedCorrections.length}
                      </span>
                    </button>
                  )}

                {verificationResult.improvedMarkdown && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${
                      activeTab === 'preview'
                        ? 'border-sky-600 text-sky-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Շտկված տարբերակի նախադիտում
                  </button>
                )}
              </div>

              {/* Tab 1: Line by Line Comparisons */}
              {activeTab === 'lines' && (
                <div className="space-y-3">
                  {verificationResult.lineComparisons.map((item, idx) => {
                    const isOk = item.status === 'match';
                    const isMinor = item.status === 'minor_difference';
                    const isFormula = item.status === 'formula_error';

                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-lg border text-xs transition-colors ${
                          isOk
                            ? 'bg-white border-slate-200'
                            : isMinor
                            ? 'bg-amber-50/50 border-amber-200'
                            : isFormula
                            ? 'bg-rose-50/50 border-rose-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="text-slate-400 font-mono-tabular">
                              #{idx + 1}
                            </span>
                            <span>{item.itemLabel}</span>
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              isOk
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : isMinor
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : isFormula
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {isOk && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                            {isMinor && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                            {isFormula && <XCircle className="w-3 h-3 text-rose-600" />}
                            <span>
                              {isOk
                                ? 'Ճշգրիտ է'
                                : isMinor
                                ? 'Փոքր շեղում'
                                : isFormula
                                ? 'Բանաձևի անճշտություն'
                                : 'Բացթողում'}
                            </span>
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                          <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                              Ռուսերեն բնօրինակ
                            </span>
                            <div className="text-slate-700 font-mono text-[11px] whitespace-pre-wrap break-words">
                              {item.originalRu}
                            </div>
                          </div>

                          <div className="bg-sky-50/40 p-2.5 rounded border border-sky-100">
                            <span className="block text-[10px] font-semibold uppercase tracking-wider text-sky-600 mb-1">
                              Հայերեն թարգմանություն
                            </span>
                            <div className="text-slate-800 font-mono text-[11px] whitespace-pre-wrap break-words">
                              {item.translationHy}
                            </div>
                          </div>
                        </div>

                        {item.comment && (
                          <div className="mt-2 text-[11px] text-slate-500 italic">
                            Դիտողություն՝ {item.comment}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tab 2: Suggested Corrections */}
              {activeTab === 'corrections' && (
                <div className="space-y-4">
                  {verificationResult.suggestedCorrections?.map((c, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-lg border border-amber-200 bg-amber-50/40 text-xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-900">
                          {c.location}
                        </span>
                        <span className="text-[11px] text-amber-700">
                          Պատճառ՝ {c.reason}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-2.5 rounded bg-white border border-rose-200">
                          <span className="block text-[10px] font-semibold text-rose-600 uppercase mb-1">
                            Ընթացիկ սխալ / բացթողում
                          </span>
                          <code className="text-[11px] text-rose-900 block font-mono">
                            {c.currentText}
                          </code>
                        </div>

                        <div className="p-2.5 rounded bg-white border border-emerald-200">
                          <span className="block text-[10px] font-semibold text-emerald-600 uppercase mb-1">
                            Առաջարկվող ճշգրտում
                          </span>
                          <code className="text-[11px] text-emerald-900 block font-mono">
                            {c.suggestedText}
                          </code>
                        </div>
                      </div>
                    </div>
                  ))}

                  {verificationResult.improvedMarkdown && (
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleApplyCorrections}
                        disabled={isApplyingCorrection}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs"
                      >
                        <Check className="w-4 h-4" />
                        <span>
                          {isApplyingCorrection
                            ? 'Կիրառվում է...'
                            : 'Կիրառել բոլոր շտկումները էջի վրա'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Improved Markdown Preview */}
              {activeTab === 'preview' && verificationResult.improvedMarkdown && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="block text-xs font-semibold text-slate-700 mb-2">
                      Շտկված էջի նախադիտում (KaTeX / Markdown)
                    </span>
                    <div className="bg-white p-5 rounded border border-slate-200">
                      <MathRenderer content={verificationResult.improvedMarkdown} />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleApplyCorrections}
                      disabled={isApplyingCorrection}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs"
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        {isApplyingCorrection
                          ? 'Կիրառվում է...'
                          : 'Ընդունել և պահպանել այս տարբերակը'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono-tabular">
            Էջ {pageNumber} · Մ. Լ. Գալիցկի
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Փակել
          </button>
        </div>
      </div>
    </div>
  );
}
