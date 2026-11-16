'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  X,
  Cloud,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  LogOut,
  FilePlus2,
  FilePenLine,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  buildCompiledBookMarkdown,
  calculateProgressStats,
  type TranslatedPage,
} from '@/lib/book-structure';
import { buildFullBookHtmlDocument } from '@/lib/exporters';
import {
  createBookInDrive,
  getCachedDriveToken,
  listAppDriveFiles,
  signInWithGoogleDrive,
  signOutGoogle,
  updateBookInDrive,
  type DriveFileItem,
} from '@/lib/google-auth';

interface DriveExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  pagesMap: Record<number, TranslatedPage>;
  onTokenChanged?: () => void;
}

export function DriveExportModal({
  isOpen,
  onClose,
  user,
  pagesMap,
  onTokenChanged,
}: DriveExportModalProps) {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successFile, setSuccessFile] = useState<DriveFileItem | null>(null);

  const [fileName, setFileName] = useState('Գալիցկի_Հանրահաշիվ_8-9_Հայերեն');
  const [exportFormat, setExportFormat] = useState<'gdoc' | 'html' | 'md'>('gdoc');
  const [selectedExistingId, setSelectedExistingId] = useState<string>('');
  const [pendingOverwriteFile, setPendingOverwriteFile] = useState<DriveFileItem | null>(null);

  const stats = calculateProgressStats(pagesMap);
  const driveToken = user ? (sessionToken ?? getCachedDriveToken()) : null;

  const fetchDriveFiles = useCallback(async (token: string) => {
    setLoadingFiles(true);
    setError(null);
    try {
      const list = await listAppDriveFiles(token);
      setFiles(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Չհաջողվեց բեռնել Drive ֆայլերը։');
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !driveToken) return;
    let active = true;
    listAppDriveFiles(driveToken)
      .then((list) => {
        if (active) setFiles(list);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Չհաջողվեց բեռնել Drive ֆայլերը։');
        }
      });
    return () => {
      active = false;
    };
  }, [isOpen, driveToken]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      const { accessToken } = await signInWithGoogleDrive();
      setSessionToken(accessToken);
      onTokenChanged?.();
      await fetchDriveFiles(accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google մուտքի սխալ։');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOutGoogle();
    setSessionToken(null);
    onTokenChanged?.();
    setFiles([]);
    setSuccessFile(null);
    setPendingOverwriteFile(null);
  };

  const getCompiledPayload = () => {
    if (exportFormat === 'md') {
      return {
        content: buildCompiledBookMarkdown(pagesMap),
        sourceMimeType: 'text/markdown' as const,
        convertToGoogleDoc: false,
        finalName: fileName.endsWith('.md') ? fileName : `${fileName}.md`,
      };
    }
    if (exportFormat === 'html') {
      return {
        content: buildFullBookHtmlDocument(pagesMap),
        sourceMimeType: 'text/html' as const,
        convertToGoogleDoc: false,
        finalName: fileName.endsWith('.html') ? fileName : `${fileName}.html`,
      };
    }
    return {
      content: buildFullBookHtmlDocument(pagesMap),
      sourceMimeType: 'text/html' as const,
      convertToGoogleDoc: true,
      finalName: fileName,
    };
  };

  const handleCreateNew = async () => {
    if (!driveToken) {
      setError('Խնդրում ենք նախ մուտք գործել Google Drive։');
      return;
    }
    setIsUploading(true);
    setError(null);
    setSuccessFile(null);
    try {
      const payload = getCompiledPayload();
      const created = await createBookInDrive(driveToken, {
        name: payload.finalName,
        content: payload.content,
        sourceMimeType: payload.sourceMimeType,
        convertToGoogleDoc: payload.convertToGoogleDoc,
      });
      setSuccessFile(created);
      await fetchDriveFiles(driveToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ֆայլի ստեղծման սխալ։');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRequestOverwrite = () => {
    const target = files.find((f) => f.id === selectedExistingId);
    if (target) {
      setPendingOverwriteFile(target);
    }
  };

  const handleConfirmOverwrite = async () => {
    if (!driveToken || !pendingOverwriteFile) return;
    setIsUploading(true);
    setError(null);
    setSuccessFile(null);
    try {
      const isMd = pendingOverwriteFile.name.toLowerCase().endsWith('.md');
      const content = isMd
        ? buildCompiledBookMarkdown(pagesMap)
        : buildFullBookHtmlDocument(pagesMap);
      const updated = await updateBookInDrive(driveToken, pendingOverwriteFile.id, {
        content,
        sourceMimeType: isMd ? 'text/markdown' : 'text/html',
      });
      setPendingOverwriteFile(null);
      setSuccessFile(updated);
      await fetchDriveFiles(driveToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ֆայլի թարմացման սխալ։');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drive-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-sky-600" />
            <h2 id="drive-modal-title" className="text-base font-bold text-slate-900">
              Պահպանել Google Drive-ում
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Փակել Google Drive պատուհանը"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div
              role="alert"
              className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {successFile && (
            <div className="p-3.5 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1.5">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Գիրքը հաջողությամբ պահպանվեց Google Drive-ում</span>
              </div>
              <p>Ֆայլ՝ {successFile.name}</p>
              {successFile.webViewLink && (
                <a
                  href={successFile.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sky-700 font-semibold hover:underline"
                >
                  <span>Բացել Google Drive-ում</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}

          {!driveToken ? (
            <div className="py-4 text-center space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Մուտք գործեք ձեր Google հաշիվ՝ հայերեն թարգմանված գիրքը ({stats.translatedCount} / {stats.totalPages} էջ) որպես Google Docs փաստաթուղթ, HTML կամ Markdown պահպանելու համար։
              </p>

              <button
                type="button"
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="gsi-material-button"
              >
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    {isSigningIn ? 'Մուտք է գործվում...' : 'Sign in with Google'}
                  </span>
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Signed-in account bar */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-slate-50 border border-slate-200 text-xs">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">
                    {user?.displayName || user?.email || 'Google Drive հաշիվը միացված է'}
                  </p>
                  {user?.email && (
                    <p className="text-slate-500 truncate">{user.email}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 text-slate-700 bg-white hover:bg-slate-100 shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Դուրս գալ</span>
                </button>
              </div>

              {/* Create new file form */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Ստեղծել նոր ֆայլ Google Drive-ում
                </h3>

                <div>
                  <label
                    htmlFor="drive-file-name"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Փաստաթղթի անունը
                  </label>
                  <input
                    id="drive-file-name"
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="drive-file-format"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Ձևաչափ
                  </label>
                  <select
                    id="drive-file-format"
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as 'gdoc' | 'html' | 'md')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="gdoc">Google Docs փաստաթուղթ (խմբագրելի)</option>
                    <option value="html">HTML փաստաթուղթ (KaTeX աջակցությամբ)</option>
                    <option value="md">Markdown (.md) LaTeX բանաձևերով</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleCreateNew}
                  disabled={isUploading || !fileName.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  <FilePlus2 className="w-4 h-4" />
                  <span>
                    {isUploading
                      ? 'Վերբեռնվում է...'
                      : `Ստեղծել Drive-ում (${stats.translatedCount} էջ)`}
                  </span>
                </button>
              </div>

              {/* Update existing file with explicit overwrite confirmation */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Կամ թարմացնել առկա ֆայլը
                  </h3>
                  <button
                    type="button"
                    onClick={() => driveToken && fetchDriveFiles(driveToken)}
                    disabled={loadingFiles}
                    className="inline-flex items-center gap-1 text-xs text-sky-700 hover:text-sky-800"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingFiles ? 'animate-spin' : ''}`} />
                    <span>Թարմացնել</span>
                  </button>
                </div>

                {files.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Այս հավելվածով ստեղծված Drive ֆայլեր դեռ չկան։
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    <select
                      aria-label="Ընտրել առկա Drive ֆայլը"
                      value={selectedExistingId}
                      onChange={(e) => setSelectedExistingId(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-sky-500"
                    >
                      <option value="">Ընտրեք ֆայլ՝ թարմացնելու համար...</option>
                      {files.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>

                    {selectedExistingId && !pendingOverwriteFile && (
                      <button
                        type="button"
                        onClick={handleRequestOverwrite}
                        disabled={isUploading}
                        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-md border border-slate-300 text-slate-800 bg-white hover:bg-slate-50"
                      >
                        <FilePenLine className="w-3.5 h-3.5" />
                        <span>Փոխարինել ընտրված ֆայլի բովանդակությունը</span>
                      </button>
                    )}

                    {/* Explicit Confirmation Before Mutating Drive File */}
                    {pendingOverwriteFile && (
                      <div className="p-3 rounded-md bg-amber-50 border border-amber-200 space-y-2.5">
                        <p className="text-xs text-amber-950 font-medium">
                          Վստա՞հ եք, որ ցանկանում եք ամբողջությամբ վերագրել «{pendingOverwriteFile.name}» ֆայլը նոր տվյալներով ({stats.translatedCount} էջ)։
                        </p>
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setPendingOverwriteFile(null)}
                            className="px-2.5 py-1 text-xs rounded border border-amber-300 text-amber-900 bg-white hover:bg-amber-100"
                          >
                            Չեղարկել
                          </button>
                          <button
                            type="button"
                            onClick={handleConfirmOverwrite}
                            disabled={isUploading}
                            className="px-3 py-1 text-xs font-medium rounded bg-amber-700 text-white hover:bg-amber-800"
                          >
                            {isUploading ? 'Թարմացվում է...' : 'Հաստատել վերագրումը'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
