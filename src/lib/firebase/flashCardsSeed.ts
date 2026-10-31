import { FLASHCARDS_CATALOG } from "./academicContent";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export async function seedPsychologyFlashcards() {
  for (const fc of FLASHCARDS_CATALOG) {
    await setDoc(doc(db, "pdfs", fc.id), {
      title: fc.title,
      class: fc.class,
      section: fc.section,
      storagePath: fc.storagePath,
      isActive: true,
      createdAt: serverTimestamp(),
    });
  }
  console.log("✅ Psychology Flashcards PDFs seeded with custom IDs");
}
