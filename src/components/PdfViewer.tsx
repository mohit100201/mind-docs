"use client";

import { auth, storage, db } from "@/lib/firebase/firebase";
import { ref, getDownloadURL, listAll, getMetadata } from "firebase/storage";
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
import { MobilePdfReader } from "./MobilePdfReader";

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
  const [availableFileList, setAvailableFileList] = useState<string[]>([]);
  const [targetStoragePath, setTargetStoragePath] = useState<string>("");
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

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
        // 1. Prioritize live Firestore document for accurate storage path & title
        let storagePath = "";
        let foundTitle = "";

        try {
          const pdfDoc = await getDoc(doc(db, "pdfs", pdfId));
          if (pdfDoc.exists()) {
            const data = pdfDoc.data();
            storagePath = data?.storagePath || "";
            foundTitle = data?.title || "";
          }
        } catch (docErr) {
          console.warn("Could not fetch document from Firestore pdfs collection:", docErr);
        }

        // Fallback to static catalog if Firestore didn't have storagePath
        if (!storagePath) {
          const catalogItem =
            DETAILED_NOTES_CATALOG.find((x) => x.id === pdfId) ||
            FLASHCARDS_CATALOG.find((x) => x.id === pdfId);

          if (catalogItem?.storagePath) {
            storagePath = catalogItem.storagePath;
          }
          if (catalogItem?.title && !foundTitle) {
            foundTitle = catalogItem.title;
          }
        }

        if (foundTitle) {
          setDocTitle(foundTitle);
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

        setTargetStoragePath(storagePath);

        // 3. Generate direct Firebase Storage URL with known naming variants
        const pathVariants = [
          storagePath,
          storagePath.trim(),
          storagePath.replace(/\s+\.pdf$/i, ".pdf"),
          storagePath.replace(/\.pdf$/i, " .pdf"),
          storagePath.replace(/ATTITUDE AND SOCIAL COGNITION/i, "Attitude and Social Cognition"),
          storagePath.replace(/ATTITUDE AND SOCIAL COGNITION/i, "Attitude and social cognition"),
          storagePath.replace(/ATTITUDE AND SOCIAL COGNITION/i, "attitude and social cognition"),
          storagePath.replace(/Chapter 6 ATTITUDE/i, "CHAPTER 6 ATTITUDE"),
          storagePath.replace(/Chapter 6 ATTITUDE/i, "Psychology Chapter 6"),
          storagePath.replace(/Chapter 6 ATTITUDE/i, "Psychology CHAPTER 6"),
          storagePath.replace(/SOCIAL INFLUENCE AND GROUP PROCESSES/i, "Social Influence and Group Processes"),
          storagePath.replace(/SOCIAL INFLUENCE AND GROUP PROCESSES/i, "Social influence and group processes"),
          storagePath.replace(/CHAPTER 3 MEETING LIFE CHALLENGES/i, "Chapter 3 Meeting Life Challenges"),
        ];

        let downloadUrl: string | null = null;
        let lastError: unknown = null;

        for (const path of pathVariants) {
          try {
            const fileRef = ref(storage, path);
            downloadUrl = await getDownloadURL(fileRef);
            if (downloadUrl) {
              setTargetStoragePath(path);
              break;
            }
          } catch (err) {
            lastError = err;
          }
        }

        // 4. Dynamic Discovery: If direct paths failed, search the folder dynamically using listAll
        const folderPath = storagePath.substring(0, storagePath.lastIndexOf("/"));
        let foundFiles: string[] = [];

        if (!downloadUrl && folderPath) {
          try {
            const folderRef = ref(storage, folderPath);
            const listResult = await listAll(folderRef);
            foundFiles = listResult.items.map((i) => i.name);
            setAvailableFileList(foundFiles);
            console.log(`[Storage Inspection] Files found in "${folderPath}":`, foundFiles);

            const expectedFileName = storagePath.substring(storagePath.lastIndexOf("/") + 1).trim();
            const chMatch = pdfId.match(/(\d+)/);
            const chNum = chMatch ? chMatch[1] : "";

            // Match priority: exact name -> chapter number -> keyword
            const matchedItem = listResult.items.find((item) => {
              const nameLower = item.name.toLowerCase();
              if (item.name === expectedFileName || item.name.trim() === expectedFileName) {
                return true;
              }
              if (item.name.replace(/\s+\.pdf$/i, ".pdf") === expectedFileName.replace(/\s+\.pdf$/i, ".pdf")) {
                return true;
              }
              if (chNum) {
                const patterns = [
                  `chapter ${chNum}`,
                  `chapter${chNum}`,
                  `ch ${chNum}`,
                  `ch${chNum}`,
                  `chapter_${chNum}`,
                  `ch_${chNum}`,
                ];
                if (patterns.some((p) => nameLower.includes(p))) {
                  return true;
                }
              }
              if (pdfId.includes("ch6") || storagePath.toLowerCase().includes("attitude")) {
                if (nameLower.includes("attitude")) return true;
              }
              if (pdfId.includes("ch7") || storagePath.toLowerCase().includes("influence")) {
                if (nameLower.includes("influence") || nameLower.includes("social")) return true;
              }
              if (pdfId.includes("ch3") || storagePath.toLowerCase().includes("challenges")) {
                if (nameLower.includes("challenges") || nameLower.includes("meeting")) return true;
              }
              return false;
            });

            if (matchedItem) {
              setTargetStoragePath(matchedItem.fullPath);
              try {
                const freshRef = ref(storage, matchedItem.fullPath);
                downloadUrl = await getDownloadURL(freshRef);
                console.log(`[Storage Inspection] Resolved via freshRef getDownloadURL: "${matchedItem.fullPath}"`);
              } catch {
                try {
                  downloadUrl = await getDownloadURL(matchedItem);
                  console.log(`[Storage Inspection] Resolved via matchedItem getDownloadURL: "${matchedItem.fullPath}"`);
                } catch (err: unknown) {
                  console.warn("getDownloadURL failed on matchedItem:", matchedItem.fullPath, err);
                  lastError = err;

                  // Fallback: extract download token from object metadata directly
                  try {
                    const meta = await getMetadata(matchedItem);
                    const metaRecord = meta as unknown as Record<string, unknown>;
                    const rawTokens = metaRecord.downloadTokens;
                    const token = Array.isArray(rawTokens)
                      ? (rawTokens[0] as string)
                      : typeof rawTokens === "string"
                      ? rawTokens.split(",")[0]
                      : "";
                    if (token) {
                      const bucket =
                        matchedItem.bucket ||
                        storage.app.options.storageBucket ||
                        "mind-docs.firebasestorage.app";
                      downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(
                        matchedItem.fullPath
                      )}?alt=media&token=${token}`;
                      console.log(`[Storage Inspection] Resolved via metadata token: "${downloadUrl}"`);
                    }
                  } catch (metaErr) {
                    console.warn("getMetadata failed:", metaErr);
                  }
                }
              }
            }
          } catch (listErr) {
            console.warn("Could not list folder contents:", listErr);
          }
        }

        // 5. Fallback: try calling server API route BEFORE failing
        if (!downloadUrl) {
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
                downloadUrl = data.url;
              }
            }
          } catch {
            // ignore API fallback failure
          }
        }

        if (downloadUrl && !cancelled) {
          setPdfUrl(downloadUrl);
          return;
        }

        const errCode = (lastError as { code?: string })?.code || "";
        const errMessage = (lastError as { message?: string })?.message || String(lastError || "");
        setErrorDetails(`${errCode ? errCode + ": " : ""}${errMessage}`);

        if (errCode === "storage/unauthorized") {
          setErrorType("storage-rules");
          setErrorMessage(
            "Firebase Storage permissions denied. Your Firebase Storage security rules are currently restricting read access."
          );
          return;
        }

        if (errCode === "storage/object-not-found" || !downloadUrl) {
          setErrorType("not-found");
          setErrorMessage(
            `File not found in Firebase Storage at: "${storagePath}". Please check the files in your Firebase Storage bucket.`
          );
          return;
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
          <div className="p-8 max-w-lg mx-auto my-auto bg-white rounded-3xl border border-slate-200 text-center shadow-lg">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900">File Not Found in Storage</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Target path: <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[11px]">{targetStoragePath}</code>
            </p>

            {errorDetails && (
              <p className="mt-2 text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2 font-mono text-left overflow-x-auto">
                Diagnostics: {errorDetails}
              </p>
            )}

            {availableFileList.length > 0 ? (
              <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left">
                <p className="text-xs font-bold text-slate-700 mb-2">
                  Files currently in this Storage folder ({availableFileList.length}):
                </p>
                <ul className="text-xs text-slate-600 space-y-1 font-mono max-h-40 overflow-y-auto">
                  {availableFileList.map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                      <span className="truncate">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-200 text-left text-xs text-amber-800">
                <p className="font-bold mb-1.5">Where to check in Firebase Console:</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>Go to <strong>Firebase Console &gt; Storage &gt; Files</strong></li>
                  <li>Click into folder: <strong>twelfth &gt; detailnotes</strong></li>
                  <li>Verify if Chapter 6 is uploaded or if the file name has different spelling.</li>
                </ol>
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className="mt-5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry Loading
            </button>
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

        {/* PDF Document View: Always opens directly in Protected Cloud View */}
        {pdfUrl && !loading && !errorType && (
          <div className="w-full h-full flex-1 bg-slate-900">
            <MobilePdfReader pdfUrl={pdfUrl} docTitle={docTitle} />
          </div>
        )}
      </div>
    </div>
  );
}
