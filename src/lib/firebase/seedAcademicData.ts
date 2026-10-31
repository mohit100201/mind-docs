import { DETAILED_NOTES_CATALOG } from "./academicContent";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export async function seedPsychologyPdfs() {
  for (const pdf of DETAILED_NOTES_CATALOG) {
    await setDoc(doc(db, "pdfs", pdf.id), {
      title: pdf.title,
      class: pdf.class,
      section: pdf.section,
      storagePath: pdf.storagePath,
      isActive: true,
      createdAt: serverTimestamp(),
    });
  }
  console.log("✅ Psychology PDFs seeded with custom IDs");
}
