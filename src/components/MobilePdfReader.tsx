"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertCircle,
  Eye,
  Layers,
} from "lucide-react";

interface MobilePdfReaderProps {
  pdfUrl: string;
  docTitle?: string;
}

declare global {
  interface Window {
    pdfjsLib?: {
      getDocument: (config: {
        url?: string;
        data?: Uint8Array;
        cMapUrl?: string;
        cMapPacked?: boolean;
      }) => {
        promise: Promise<PdfDocumentProxy>;
      };
      GlobalWorkerOptions: {
        workerSrc: string;
      };
    };
  }
}

interface PdfPageProxy {
  pageNumber: number;
  getViewport: (params: { scale: number }) => {
    width: number;
    height: number;
  };
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => {
    promise: Promise<void>;
    cancel: () => void;
  };
}

interface PdfDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  destroy: () => Promise<void>;
}

export function MobilePdfReader({ pdfUrl, docTitle }: MobilePdfReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState("Initializing viewer...");
  const [totalPages, setTotalPages] = useState(0);
  const [renderedCount, setRenderedCount] = useState(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [error, setError] = useState<string | null>(null);
  const [useGoogleFallback, setUseGoogleFallback] = useState(false);

  const pdfDocRef = useRef<PdfDocumentProxy | null>(null);
  const activeRenderTasksRef = useRef<Map<number, { cancel: () => void }>>(new Map());
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  // Dynamically load PDF.js from reliable CDN
  const loadPdfJsScript = useCallback((): Promise<typeof window.pdfjsLib> => {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) {
        resolve(window.pdfjsLib);
        return;
      }

      const existingScript = document.querySelector(
        'script[data-pdfjs="true"]'
      ) as HTMLScriptElement | null;

      if (existingScript) {
        existingScript.addEventListener("load", () => {
          if (window.pdfjsLib) resolve(window.pdfjsLib);
          else reject(new Error("pdfjsLib not defined after script load"));
        });
        existingScript.addEventListener("error", () =>
          reject(new Error("Failed to load PDF.js script"))
        );
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.async = true;
      script.dataset.pdfjs = "true";
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          resolve(window.pdfjsLib);
        } else {
          reject(new Error("pdfjsLib global not available"));
        }
      };
      script.onerror = () => reject(new Error("Failed to load PDF.js from CDN"));
      document.head.appendChild(script);
    });
  }, []);

  // Cancel any running renders before starting a new one
  const cancelAllRenders = useCallback(() => {
    activeRenderTasksRef.current.forEach((task) => {
      try {
        task.cancel();
      } catch {
        // ignore
      }
    });
    activeRenderTasksRef.current.clear();
  }, []);

  // Render a single page to its canvas
  const renderSinglePage = useCallback(
    async (
      pdfDoc: PdfDocumentProxy,
      pageNumber: number,
      canvas: HTMLCanvasElement,
      zoom: number
    ) => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const containerWidth =
          containerRef.current?.clientWidth || window.innerWidth || 360;

        // Calculate scale to naturally fit mobile screen width (with small margin)
        const unscaledViewport = page.getViewport({ scale: 1 });
        const horizontalPadding = 24;
        const baseScale = Math.max(
          0.5,
          (containerWidth - horizontalPadding) / unscaledViewport.width
        );
        const effectiveScale = baseScale * zoom;

        const viewport = page.getViewport({ scale: effectiveScale });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5); // crisp high-DPI rendering

        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        // Cancel previous render on this page if still ongoing
        const existingTask = activeRenderTasksRef.current.get(pageNumber);
        if (existingTask) {
          existingTask.cancel();
          activeRenderTasksRef.current.delete(pageNumber);
        }

        const renderTask = page.render({
          canvasContext: ctx,
          viewport,
        });

        activeRenderTasksRef.current.set(pageNumber, renderTask);
        await renderTask.promise;
        activeRenderTasksRef.current.delete(pageNumber);

        setRenderedCount((prev) => Math.max(prev, pageNumber));
      } catch (err: unknown) {
        const errorObj = err as { name?: string };
        if (errorObj?.name !== "RenderingCancelledException") {
          console.warn(`Error rendering page ${pageNumber}:`, err);
        }
      }
    },
    []
  );

  // Load and decode the PDF document
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        setLoading(true);
        setError(null);
        setLoadingProgress("Loading PDF engine...");

        const pdfjs = await loadPdfJsScript();
        if (cancelled || !pdfjs) return;

        setLoadingProgress("Fetching document securely...");

        // Try proxy first to bypass any potential CORS limitations, fallback to direct URL
        const proxyUrl = `/api/pdf-proxy?url=${encodeURIComponent(pdfUrl)}`;

        let doc: PdfDocumentProxy | null = null;
        try {
          const task = pdfjs.getDocument({
            url: proxyUrl,
            cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
            cMapPacked: true,
          });
          doc = await task.promise;
        } catch (fetchErr) {
          console.warn("Proxy fetch failed, attempting direct load:", fetchErr);
          const task = pdfjs.getDocument({
            url: pdfUrl,
            cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
            cMapPacked: true,
          });
          doc = await task.promise;
        }

        if (cancelled || !doc) return;

        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
        setLoadingProgress(`Preparing ${doc.numPages} pages...`);
      } catch (err: unknown) {
        if (cancelled) return;
        console.error("❌ MobilePdfReader load error:", err);
        setError("Unable to initialize canvas reader. You can switch to Cloud Reader.");
        setUseGoogleFallback(true);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      cancelAllRenders();
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy().catch(() => {});
        pdfDocRef.current = null;
      }
    };
  }, [pdfUrl, loadPdfJsScript, cancelAllRenders]);

  // Re-render pages when zoomLevel or totalPages change
  useEffect(() => {
    const doc = pdfDocRef.current;
    if (!doc || totalPages === 0) return;

    cancelAllRenders();

    // Render pages sequentially for smooth loading
    let cancelled = false;
    const renderAll = async () => {
      for (let i = 1; i <= totalPages; i++) {
        if (cancelled) break;
        const canvas = canvasRefs.current.get(i);
        if (canvas) {
          await renderSinglePage(doc, i, canvas, zoomLevel);
        }
      }
    };

    renderAll();

    return () => {
      cancelled = true;
      cancelAllRenders();
    };
  }, [totalPages, zoomLevel, renderSinglePage, cancelAllRenders]);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(2.5, +(prev + 0.25).toFixed(2)));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(0.75, +(prev - 0.25).toFixed(2)));
  };

  const handleResetZoom = () => {
    setZoomLevel(1.0);
  };

  // Google Cloud Viewer fallback (embedded iframe)
  if (useGoogleFallback) {
    return (
      <div className="w-full h-full relative flex flex-col bg-slate-900">
        {/* Top switch bar */}
        <div className="h-10 bg-slate-800 border-b border-slate-700 px-3 flex items-center justify-between text-xs text-slate-300">
          <span className="flex items-center gap-1.5 font-medium text-slate-300">
            <Eye className="w-3.5 h-3.5 text-indigo-400" />
            <span>Cloud Reader Mode</span>
          </span>
          <button
            onClick={() => setUseGoogleFallback(false)}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-bold flex items-center gap-1"
          >
            <Layers className="w-3 h-3" />
            <span>Try Canvas Reader</span>
          </button>
        </div>

        {/* Embedded viewer iframe */}
        <div className="flex-1 w-full h-[calc(100%-2.5rem)] relative">
          <iframe
            src={`https://docs.google.com/viewer?url=${encodeURIComponent(pdfUrl)}&embedded=true`}
            className="w-full h-full border-0 bg-white"
            title="Cloud Document Reader"
          />
          {/* Transparent overlay over top right pop-out icon to discourage external downloading */}
          <div
            className="absolute top-0 right-0 w-16 h-14 z-20 pointer-events-auto bg-transparent"
            title="In-app reading mode"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col bg-slate-900 text-slate-100 overflow-hidden select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Mobile Toolbar: Zoom controls & Mode Switch */}
      <div className="h-11 bg-slate-800/95 border-b border-slate-700/80 px-3 sm:px-4 flex items-center justify-between text-xs shrink-0 z-20">
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            disabled={zoomLevel <= 0.75}
            className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-40 transition-all"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono font-bold text-slate-300 px-1 min-w-[42px] text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={zoomLevel >= 2.5}
            className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-40 transition-all"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          {zoomLevel !== 1.0 && (
            <button
              onClick={handleResetZoom}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-all ml-0.5"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          {totalPages > 0 && (
            <span className="text-[11px] font-medium text-slate-400">
              {renderedCount > 0 ? `${renderedCount}/${totalPages} Pages` : `${totalPages} Pages`}
            </span>
          )}
          <button
            onClick={() => setUseGoogleFallback(true)}
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-medium transition-all"
            title="Switch to Cloud Reader if pages are not displaying"
          >
            Cloud View
          </button>
        </div>
      </div>

      {/* Main Reading Canvas Scroll View */}
      <div className="flex-1 w-full overflow-y-auto overflow-x-auto p-3 sm:p-4 flex flex-col items-center gap-4 scroll-smooth">
        {loading && (
          <div className="my-auto py-16 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
            <p className="text-sm font-bold text-slate-200">{loadingProgress}</p>
            <p className="text-xs text-slate-400 mt-1">Rendering high-res pages for mobile</p>
          </div>
        )}

        {error && (
          <div className="my-auto p-6 max-w-sm bg-slate-800 rounded-2xl border border-rose-500/30 text-center">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
            <p className="text-xs text-rose-300 mb-3">{error}</p>
            <button
              onClick={() => setUseGoogleFallback(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl"
            >
              Open in Cloud Reader
            </button>
          </div>
        )}

        {/* Generated Canvas for each PDF page */}
        {!loading &&
          !error &&
          Array.from({ length: totalPages }, (_, index) => {
            const pageNum = index + 1;
            return (
              <div
                key={pageNum}
                className="bg-white rounded-xl shadow-xl overflow-hidden flex flex-col items-center border border-slate-700/50 transition-transform"
              >
                <canvas
                  ref={(el) => {
                    if (el) canvasRefs.current.set(pageNum, el);
                    else canvasRefs.current.delete(pageNum);
                  }}
                  className="block select-none pointer-events-none"
                  onContextMenu={(e) => e.preventDefault()}
                />
                <div className="w-full bg-slate-100 border-t border-slate-200 py-1 px-3 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>Page {pageNum}</span>
                  <span>{docTitle || "Study Material"}</span>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
