"use client";

import { auth } from "@/lib/firebase/firebase";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export function PdfViewer({ pdfId }: { pdfId: string }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      try {
        setLoading(true);

        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        const res = await fetch(`/api/pdf/${pdfId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch signed URL");
        }

        const { url } = await res.json();

        if (!cancelled) {
          setPdfUrl(url);
        }
      } catch (err) {
        console.error("❌ Error loading PDF:", err);
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

  // 📱 Best UX: open in new tab on mobile
  useEffect(() => {
    if (!pdfUrl) return;

    if (window.innerWidth < 768) {
      window.open(pdfUrl, "_blank");
    }
  }, [pdfUrl]);

  return (
    <div
      className="w-full h-full relative bg-white"
      onContextMenu={(e) => e.preventDefault()}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        </div>
      )}

      {pdfUrl && (
        <object
          data={`${pdfUrl}#toolbar=0&navpanes=0`}
          type="application/pdf"
          width="100%"
          height="100%"
        >
          {/* Fallback */}
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
            Open PDF
          </a>
        </object>
      )}
    </div>
  );
}
