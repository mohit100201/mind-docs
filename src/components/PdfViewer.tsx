import { auth } from "@/lib/firebase/firebase";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

export function PdfViewer({ pdfId }: { pdfId: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadPdf = async () => {
      try {
        setLoading(true);
        const token = await auth.currentUser?.getIdToken();
        if (!token || controller.signal.aborted) return;

        const res = await fetch(`/api/pdf/${pdfId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("Failed to load PDF");

        const blob = await res.blob();
        if (controller.signal.aborted) return;

        // Cleanup previous blob URL if exists
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }

        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;

        if (iframeRef.current) {
          // Append parameters to hide toolbar, nav panes, and scrollbars
          iframeRef.current.src = `${url}#toolbar=0&navpanes=0&scrollbar=0`;
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Error loading PDF:", error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      controller.abort();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [pdfId]);

  return (
    <div className="w-full h-full select-none relative" onContextMenu={(e) => e.preventDefault()}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        </div>
      )}
      <iframe
        ref={iframeRef}
        className="w-full h-full"
      // sandbox="allow-same-origin" // Removed to allow blob loading
      />
    </div>
  );
}
