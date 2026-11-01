import { db, storage } from "./firebase";
import {
  ref,
  uploadBytesResumable,
  deleteObject,
  getDownloadURL,
} from "firebase/storage";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  AcademicPdfItem,
  DETAILED_NOTES_CATALOG,
  FLASHCARDS_CATALOG,
} from "./academicContent";

export interface UploadPdfParams {
  file: File;
  title: string;
  classLevel: "twelfth" | "eleventh" | string;
  section: "detailnotes" | "flashcards";
  customId?: string;
  onProgress?: (percent: number) => void;
}

/**
 * Fetch all PDFs registered in Firestore (or fallback to static catalog if empty)
 */
export async function getLivePdfsList(): Promise<AcademicPdfItem[]> {
  try {
    const snap = await getDocs(collection(db, "pdfs"));
    if (!snap.empty) {
      return snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || d.id,
          class: data.class || "twelfth",
          section: data.section || "detailnotes",
          storagePath: data.storagePath || "",
          file: data.file || "",
          isActive: data.isActive ?? true,
        };
      });
    }
  } catch (err) {
    console.warn("Could not fetch pdfs from Firestore, using catalog:", err);
  }

  return [...DETAILED_NOTES_CATALOG, ...FLASHCARDS_CATALOG];
}

/**
 * Clean and sanitize PDF filenames to avoid trailing spaces and URL-encoding bugs
 */
export function sanitizePdfFileName(rawName: string): string {
  let name = rawName.trim();
  // Strip trailing spaces right before .pdf extension
  name = name.replace(/\s+\.pdf$/i, ".pdf");
  // Replace slashes or backslashes
  name = name.replace(/[/\\?%*:|"<>]/g, "_");
  // Ensure .pdf extension
  if (!name.toLowerCase().endsWith(".pdf")) {
    name += ".pdf";
  }
  return name;
}

/**
 * Generate a clean, structured document ID if not manually provided
 */
export function generatePdfDocumentId(
  title: string,
  section: "detailnotes" | "flashcards",
  customId?: string
): string {
  if (customId && customId.trim()) {
    return customId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  }

  // Check if title mentions a chapter number e.g. "Chapter 8", "Ch 8", etc.
  const match = title.match(/(?:chapter|ch)\s*(\d+)/i) || title.match(/(\d+)/);
  const chNum = match ? match[1] : "";

  if (section === "flashcards") {
    return chNum ? `psy_fc_ch${chNum}` : `psy_fc_${Date.now().toString(36)}`;
  } else {
    return chNum ? `psy_ch${chNum}` : `psy_${Date.now().toString(36)}`;
  }
}

/**
 * Upload a PDF to Firebase Storage and register it in Cloud Firestore
 */
export async function uploadPdfMaterial({
  file,
  title,
  classLevel,
  section,
  customId,
  onProgress,
}: UploadPdfParams): Promise<AcademicPdfItem> {
  if (!file) {
    throw new Error("No file selected.");
  }

  const cleanFileName = sanitizePdfFileName(file.name);
  const storagePath = `${classLevel}/${section}/${cleanFileName}`;
  const docId = generatePdfDocumentId(title, section, customId);

  // 1. Upload file to Firebase Storage
  const fileRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(fileRef, file, {
    contentType: "application/pdf",
  });

  await new Promise<void>((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          const progress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          onProgress(progress);
        }
      },
      (error) => {
        reject(error);
      },
      () => {
        if (onProgress) onProgress(100);
        resolve();
      }
    );
  });

  // 2. Save document record in Cloud Firestore
  const pdfItem: AcademicPdfItem = {
    id: docId,
    title: title.trim(),
    class: classLevel,
    section,
    storagePath,
    file: cleanFileName,
    isActive: true,
  };

  await setDoc(
    doc(db, "pdfs", docId),
    {
      id: docId,
      title: title.trim(),
      class: classLevel,
      section,
      storagePath,
      file: cleanFileName,
      isActive: true,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  return pdfItem;
}

/**
 * Delete a PDF from Firebase Storage and remove its document from Cloud Firestore
 */
export async function deletePdfMaterial(
  docId: string,
  storagePath: string
): Promise<void> {
  // 1. Delete from Firebase Storage if path exists
  if (storagePath) {
    try {
      const fileRef = ref(storage, storagePath);
      await deleteObject(fileRef);
    } catch {
      // Try variations if file had a trailing space before .pdf or vice versa
      let deleted = false;
      const variations: string[] = [];
      if (storagePath.endsWith(" .pdf")) {
        variations.push(storagePath.replace(/\s+\.pdf$/i, ".pdf"));
      } else if (storagePath.endsWith(".pdf")) {
        variations.push(storagePath.replace(/\.pdf$/i, " .pdf"));
      }
      for (const altPath of variations) {
        try {
          await deleteObject(ref(storage, altPath));
          deleted = true;
          break;
        } catch {
          // continue
        }
      }
      if (!deleted) {
        console.warn("Storage file could not be deleted or was already removed:", storagePath);
      }
    }
  }

  // 2. Delete document from Firestore
  await deleteDoc(doc(db, "pdfs", docId));
}

/**
 * Update the title (name) of a PDF study material in Cloud Firestore
 */
export async function updatePdfMaterialTitle(
  docId: string,
  newTitle: string
): Promise<void> {
  const trimmed = newTitle.trim();
  if (!trimmed) {
    throw new Error("Document title cannot be empty.");
  }
  const pdfRef = doc(db, "pdfs", docId);
  await setDoc(
    pdfRef,
    {
      title: trimmed,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Get a direct preview URL for an uploaded PDF item
 */
export async function getPdfPreviewUrl(storagePath: string): Promise<string> {
  const fileRef = ref(storage, storagePath);
  return await getDownloadURL(fileRef);
}
