import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export async function seedPsychologyPdfs() {
  const pdfs = [
    {
      id: "psy_ch1",
      title: "Variations in Psychological Attributes",
      file: "Psychology CHAPTER 1.pdf",
    },
    {
      id: "psy_ch2",
      title: "Self and Personality",
      file: "CHAPTER 2 SELF AND PERSONALITY.pdf",
    },
    {
      id: "psy_ch3",
      title: "Meeting Life Challenges",
      file: "CHAPTER 3 MEETING LIFE CHALLENGES.pdf",
    },
    {
      id: "psy_ch4",
      title: "Psychological Disorders",
      file: "Chapter 4 PSYCHOLOGICAL DISORDERS.pdf",
    },
    {
      id: "psy_ch5",
      title: "Therapeutic Approaches",
      file: "Chapter 5 Therapeutic approaches.pdf",
    },
    {
      id: "psy_ch6",
      title: "Attitude and Social Cognition",
      file: "Chapter 6 ATTITUDE AND SOCIAL COGNITION.pdf",
    },
    {
      id: "psy_ch7",
      title: "Social Influence and Group Processes",
      file: "Chapter 7 SOCIAL INFLUENCE AND GROUP PROCESSES.pdf",
    },
  ];

  for (const pdf of pdfs) {
    await setDoc(doc(db, "pdfs", pdf.id), {
      title: pdf.title,
      class: "twelfth",
      section: "detailnotes",
      storagePath: `twelfth/detailnotes/${pdf.file}`,
      isActive: true,
      createdAt: serverTimestamp(),
    });
  }

  console.log("✅ Psychology PDFs seeded with custom IDs");
}
