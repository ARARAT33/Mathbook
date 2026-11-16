'use client';

import React, { useEffect, useRef, useState } from 'react';
import { RotateCw, ZoomIn, ZoomOut, AlertCircle } from 'lucide-react';

interface PdfPageViewerProps {
  page: number;
}

export function PdfPageViewer({ page }: PdfPageViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;

    async function renderPdfPage() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/pdf-page?page=${page}`);
        if (!res.ok) {
          throw new Error(`Չհաջողվեց բեռնել PDF էջ ${page}-ը (${res.status})`);
        }
        const buffer = await res.arrayBuffer();
        if (cancelled) return;

        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(buffer),
          wasmUrl: '/pdfjs-wasm/',
        });
        const pdfDoc = await loadingTask.promise;
        if (cancelled) {
          await loadingTask.destroy();
          return;
        }

        const pdfPage = await pdfDoc.getPage(1);
        if (cancelled) {
          await loadingTask.destroy();
          return;
        }

        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) {
          await loadingTask.destroy();
          return;
        }

        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const availableWidth = Math.max(container.clientWidth - 24, 280);
        const fitScale = availableWidth / baseViewport.width;
        const cssScale = Math.max(0.6, Math.min(2.8, fitScale * zoom));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        const viewport = pdfPage.getViewport({ scale: cssScale * dpr });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          await loadingTask.destroy();
          return;
        }

        renderTask = pdfPage.render({
          canvasContext: ctx,
          viewport,
          canvas,
        });

        await (renderTask as unknown as { promise: Promise<void> }).promise;
        await loadingTask.destroy();
        if (!cancelled) {
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'PDF ցուցադրման սխալ';
          // Ignore intentional render cancellation errors
          if (!message.toLowerCase().includes('cancel')) {
            setError(message);
          }
          setLoading(false);
        }
      }
    }

    void renderPdfPage();

    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // Ignore
        }
      }
    };
  }, [page, zoom]);

  return (
    <div className="flex-1 flex flex-col bg-slate-100 overflow-hidden">
      {/* Zoom controls bar */}
      <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
        <span>Մասշտաբ՝ {Math.round(zoom * 100)}%</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.15).toFixed(2))))}
            aria-label="Փոքրացնել բնօրինակ էջը"
            className="p-1 rounded hover:bg-slate-200 text-slate-700"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1.0)}
            className="px-1.5 py-0.5 rounded hover:bg-slate-200 font-mono-tabular"
          >
            100%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))))}
            aria-label="Մեծացնել բնօրինակ էջը"
            className="p-1 rounded hover:bg-slate-200 text-slate-700"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable Canvas Stage */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-3 flex flex-col items-center justify-start relative min-h-[380px]"
      >
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100/80 z-10 text-xs text-slate-600 gap-2">
            <RotateCw className="w-5 h-5 animate-spin text-sky-600" />
            <span>Բեռնվում է բնօրինակ էջ {page}-ը...</span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="m-4 p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <canvas
          ref={canvasRef}
          aria-label={`Բնօրինակ PDF էջ ${page} նկար`}
          className="bg-white shadow-sm border border-slate-200 rounded-xs max-w-none"
        />
      </div>
    </div>
  );
}
