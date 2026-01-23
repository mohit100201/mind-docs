import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export async function seedPsychologyFlashcards() {
  const flashcards = [
    {
      id: "psy_fc_ch1",
      title: "Flashcards – Variations in Psychological Attributes",
      file: "Flashcards for Chapter 1.pdf",
    },
    {
      id: "psy_fc_ch2",
      title: "Flashcards – Self and Personality",
      file: "Flashcards for Chapter 2.pdf",
    },
    {
      id: "psy_fc_ch3",
      title: "Flashcards – Meeting Life Challenges",
      file: "Flashcards for Chapter 3.pdf",
    },
    {
      id: "psy_fc_ch4",
      title: "Flashcards – Psychological Disorders",
      file: "Flashcards for Chapter 4.pdf",
    },
    {
      id: "psy_fc_ch5",
      title: "Flashcards – Therapeutic Approaches",
      file: "Flashcards for Chapter 5.pdf",
    },
    {
      id: "psy_fc_ch6",
      title: "Flashcards – Attitude and Social Cognition",
      file: "Flashcards for Chapter 6.pdf",
    },
    {
      id: "psy_fc_ch7",
      title: "Flashcards – Social Influence and Group Processes",
      file: "Flashcards for Chapter 7.pdf",
    },
  ];

  for (const fc of flashcards) {
    await setDoc(doc(db, "pdfs", fc.id), {
      title: fc.title,
      class: "twelfth",
      section: "flashcards", // ✅ DIFFERENT SECTION
      storagePath: `twelfth/flashcards/${fc.file}`, // ✅ DIFFERENT FOLDER
      isActive: true,
      createdAt: serverTimestamp(),
    });
  }

  console.log("✅ Psychology Flashcards PDFs seeded with custom IDs");
}
