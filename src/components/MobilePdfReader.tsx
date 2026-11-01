"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, Lock } from "lucide-react";

interface MobilePdfReaderProps {
  pdfUrl: string;
  docTitle?: string;
}

export function MobilePdfReader({ pdfUrl, docTitle }: MobilePdfReaderProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Encode the Firebase download URL for Google Docs Viewer
  const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(
    pdfUrl
  )}&embedded=true`;

  return (
    <div
      className="w-full h-full relative flex flex-col bg-slate-900 select-none overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Loading Spinner until cloud document is ready */}
      {!iframeLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-20 backdrop-blur-xs text-center p-6">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
          <p className="text-sm font-bold text-slate-100">
            Opening {docTitle || "Study Material"}...
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Secured in-app reading</span>
          </div>
        </div>
      )}

      {/* Main Document Viewer Container */}
      <div className="flex-1 w-full h-full relative">
        {/*
          CRITICAL SECURITY LAYER 1: IFRAME SANDBOX
          - 'allow-scripts' & 'allow-same-origin': Required for Google Docs Viewer to render pages.
          - 'allow-popups' is STRICTLY OMITTED: The browser will forcibly block any window.open,
            target="_blank", or new tab requests originating from inside the iframe.
          - 'allow-downloads' is STRICTLY OMITTED: The browser will reject any download attempt.
          - 'allow-top-navigation' is STRICTLY OMITTED: Prevents redirecting your app.
        */}
        <iframe
          src={viewerUrl}
          className="w-full h-full border-0 bg-white block"
          title={docTitle || "Protected Document Viewer"}
          sandbox="allow-scripts allow-same-origin allow-forms"
          onLoad={() => setIframeLoaded(true)}
        />

        {/*
          CRITICAL SECURITY LAYER 2: INTERCEPTOR SHIELD
          Covers the exact top-right corner where Google Docs Viewer displays the "Pop-out" icon (↗).
          Catches and cancels any mouse clicks or touchscreen taps so the user cannot even trigger
          the external open button.
        */}
        <div
          className="absolute top-0 right-0 w-28 h-20 z-30 pointer-events-auto cursor-default bg-transparent select-none touch-none"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          title="In-app protected viewing"
          aria-hidden="true"
        />

        {/* Security badge at bottom to reassure students of protected viewing */}
        <div className="absolute bottom-2 left-3 z-20 pointer-events-none hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-xs border border-slate-700/60 text-[11px] text-slate-300 font-medium shadow-md">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Protected In-App Mode</span>
        </div>
      </div>
    </div>
  );
}
