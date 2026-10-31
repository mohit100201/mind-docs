"use client";

import { auth, storage, db } from "@/lib/firebase/firebase";
import { ref, getDownloadURL } from "firebase/storage";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState, useRef } from "react";
import {
  Loader2,
  AlertCircle,
  Lock,
  RefreshCw,
  Copy,
  Check,
  FileText,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  DETAILED_NOTES_CATALOG,
  FLASHCARDS_CATALOG,
} from "@/lib/firebase/academicContent";
import { isUserAdmin } from "@/lib/firebase/adminService";

export function PdfViewer({
  pdfId,
  onClose,
}: {
  pdfId: string;
  onClose?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState("Protected Study Material");
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [errorType, setErrorType] = useState<
    "permission" | "storage-rules" | "not-found" | "generic" | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedRules, setCopiedRules] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.warn("Fullscreen toggle failed:", err);
    }
  };

  const recommendedStorageRules = `rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}`;

  const copyStorageRules = () => {
    navigator.clipboard.writeText(recommendedStorageRules);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 3000);
  };

  // Block Ctrl+S / Ctrl+P to prevent downloading and printing
  useEffect(() => {
    const handlePreventDownload = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "s" || e.key === "S" || e.key === "p" || e.key === "P")
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handlePreventDownload);
    return () => window.removeEventListener("keydown", handlePreventDownload);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      try {
        setLoading(true);
        setErrorType(null);
        setErrorMessage(null);

        const currentUser = auth.currentUser;
        if (!currentUser) {
          setErrorType("permission");
          setErrorMessage("You must be logged in to view this material.");
          return;
        }

        // 1. Find catalog item metadata
        const catalogItem =
          DETAILED_NOTES_CATALOG.find((x) => x.id === pdfId) ||
          FLASHCARDS_CATALOG.find((x) => x.id === pdfId);

        if (catalogItem?.title) {
          setDocTitle(catalogItem.title);
        }

        let storagePath = catalogItem?.storagePath || "";

        // If not in static catalog, check Firestore pdfs collection
        if (!storagePath) {
          try {
            const pdfDoc = await getDoc(doc(db, "pdfs", pdfId));
            if (pdfDoc.exists()) {
              storagePath = pdfDoc.data()?.storagePath || "";
            }
          } catch {
            // ignore
          }
        }

        if (!storagePath) {
          setErrorType("not-found");
          setErrorMessage(`Study material not found in catalog: ${pdfId}`);
          return;
        }

        // 2. Access control check
        const userIsAdmin = isUserAdmin(currentUser.email);
        if (!userIsAdmin) {
          try {
            const userDoc = await getDoc(doc(db, "users", currentUser.uid));
            const userData = userDoc.exists() ? userDoc.data() : {};
            const allowedPdfs: string[] = userData.allowedPdfs || [];
            const allowedFlash: string[] = userData.allowedFlashCards || [];

            const isPermitted =
              userData.role === "admin" ||
              allowedPdfs.includes(pdfId) ||
              allowedFlash.includes(pdfId);

            if (!isPermitted) {
              setErrorType("permission");
              setErrorMessage(
                "You do not have access to this study material yet. Please contact your administrator to assign this content to your account."
              );
              return;
            }
          } catch (err: unknown) {
            console.warn("Could not verify student permissions in Firestore:", err);
          }
        }

        // 3. Generate direct Firebase Storage URL
        const pathVariants = [
          storagePath,
          storagePath.trim(),
          storagePath.replace(/\s+\.pdf$/i, ".pdf"),
          storagePath.replace(/\.pdf$/i, " .pdf"),
        ];

        let downloadUrl: string | null = null;
        let lastError: unknown = null;

        for (const path of pathVariants) {
          try {
            const fileRef = ref(storage, path);
            downloadUrl = await getDownloadURL(fileRef);
            if (downloadUrl) break;
          } catch (err) {
            lastError = err;
          }
        }

        if (downloadUrl && !cancelled) {
          setPdfUrl(downloadUrl);
          return;
        }

        const errCode = (lastError as { code?: string })?.code || "";

        if (errCode === "storage/unauthorized") {
          setErrorType("storage-rules");
          setErrorMessage(
            "Firebase Storage permissions denied. Your Firebase Storage security rules are currently restricting read access."
          );
          return;
        }

        if (errCode === "storage/object-not-found") {
          setErrorType("not-found");
          setErrorMessage(
            `File not found in Firebase Storage at: "${storagePath}". Please verify that this file has been uploaded to your Firebase Storage bucket.`
          );
          return;
        }

        // 4. Fallback: try calling server API route
        try {
          const token = await currentUser.getIdToken();
          const res = await fetch(`/api/pdf/${pdfId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (res.ok) {
            const data = await res.json();
            if (data?.url && !cancelled) {
              setPdfUrl(data.url);
              return;
            }
          }
        } catch {
          // ignore API fallback failure
        }

        throw lastError || new Error("Could not retrieve study material");
      } catch (err: unknown) {
        if (cancelled) return;
        const errObj = err as { code?: string; message?: string };
        console.error("❌ Error loading PDF:", err);

        if (errObj.code === "storage/unauthorized") {
          setErrorType("storage-rules");
          setErrorMessage(
            "Firebase Storage permissions denied. Your Firebase Storage security rules need to be updated."
          );
        } else if (errObj.code === "storage/object-not-found") {
          setErrorType("not-found");
          setErrorMessage(
            "The requested PDF file was not found in your Firebase Storage bucket."
          );
        } else {
          setErrorType("generic");
          setErrorMessage(errObj.message || "Failed to load study material.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [pdfId]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative bg-slate-100 flex flex-col overflow-hidden select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Top Navigation Bar: Title, Protection Badge, Fullscreen & Close Button */}
      <div className="h-12 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between text-xs text-slate-600 shrink-0 z-30 select-none">
        <div className="flex items-center gap-2.5 min-w-0 pr-4">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0"></span>
          <span className="font-bold text-slate-800 text-sm truncate max-w-xs sm:max-w-md md:max-w-xl">
            {docTitle}
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
            <Lock className="w-3 h-3 text-slate-500" />
            <span>Downloads Restricted</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all flex items-center justify-center gap-1.5 text-xs font-semibold border border-slate-200"
            title={isFullscreen ? "Exit Full Screen" : "Enter Full Screen"}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden sm:inline">Exit Full Screen</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden sm:inline">Full Screen</span>
              </>
            )}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all flex items-center justify-center border border-transparent hover:border-rose-100"
              title="Close Viewer (Esc)"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 w-full h-[calc(100%-3rem)] relative flex flex-col">
        {/* Loading State */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-20 backdrop-blur-xs">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
            <p className="text-sm font-bold text-slate-700">
              Loading study material...
            </p>
            <p className="text-xs text-slate-400 mt-1">Connecting to Firebase</p>
          </div>
        )}

        {/* Storage Rules Error Banner */}
        {errorType === "storage-rules" && (
          <div className="p-8 max-w-xl mx-auto my-auto bg-white rounded-3xl border-2 border-amber-300 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-3">
                <h3 className="text-base font-bold text-amber-900">
                  Firebase Storage Rules Need Updating
                </h3>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Your Storage rules tab currently denies authenticated file downloads. Open{" "}
                  <strong>Firebase Console &gt; Storage &gt; Rules</strong> tab and paste:
                </p>

                <div className="relative">
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs overflow-x-auto font-mono">
                    {recommendedStorageRules}
                  </pre>
                  <button
                    onClick={copyStorageRules}
                    className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm"
                  >
                    {copiedRules ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedRules ? "Copied!" : "Copy Storage Rules"}</span>
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry Loading PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Permission Denied */}
        {errorType === "permission" && (
          <div className="p-8 max-w-md mx-auto my-auto bg-white rounded-3xl border border-slate-200 text-center shadow-lg">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900">Access Restricted</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              {errorMessage}
            </p>
          </div>
        )}

        {/* File Not Found */}
        {errorType === "not-found" && (
          <div className="p-8 max-w-md mx-auto my-auto bg-white rounded-3xl border border-slate-200 text-center shadow-lg">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900">File Not Found</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              {errorMessage}
            </p>
          </div>
        )}

        {/* Generic Error */}
        {errorType === "generic" && (
          <div className="p-8 max-w-md mx-auto my-auto bg-white rounded-3xl border border-slate-200 text-center shadow-lg">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900">Unable to Open PDF</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              {errorMessage}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl"
            >
              Retry
            </button>
          </div>
        )}

        {/* PDF Document View with download/print toolbar disabled */}
        {pdfUrl && !loading && !errorType && (
          <div className="w-full h-full flex-1 bg-slate-900">
            <object
              data={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
              type="application/pdf"
              className="w-full h-full border-0 block"
            >
              <div className="p-8 text-center bg-white h-full flex flex-col items-center justify-center">
                <Lock className="w-10 h-10 text-slate-400 mb-3" />
                <p className="text-sm font-bold text-slate-800 mb-1">
                  Protected Document Viewer
                </p>
                <p className="text-xs text-slate-400 max-w-sm">
                  This document is protected and configured for in-app viewing only.
                </p>
              </div>
            </object>
          </div>
        )}
      </div>
    </div>
  );
}
