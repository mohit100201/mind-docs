import { doc, setDoc, serverTimestamp, getDocs, collection } from "firebase/firestore";
import { db } from "./firebase";

export interface AcademicPdfItem {
  id: string;
  title: string;
  class: string;
  section: "detailnotes" | "flashcards";
  storagePath: string;
  file: string;
  isActive: boolean;
}

export const DETAILED_NOTES_CATALOG: AcademicPdfItem[] = [
  {
    id: "psy_ch1",
    title: "Chapter 1: Variations in Psychological Attributes",
    class: "twelfth",
    section: "detailnotes",
    file: "CHAPTER_1_VARIATIONS_IN_PSYCHOLOGICAL_ATTRIBUTES.pdf",
    storagePath: "twelfth/detailnotes/CHAPTER_1_VARIATIONS_IN_PSYCHOLOGICAL_ATTRIBUTES.pdf",
    isActive: true,
  },
  {
    id: "psy_ch2",
    title: "Chapter 2: Self and Personality",
    class: "twelfth",
    section: "detailnotes",
    file: "CHAPTER_2_SELF_AND_PERSONALITY.pdf",
    storagePath: "twelfth/detailnotes/CHAPTER_2_SELF_AND_PERSONALITY.pdf",
    isActive: true,
  },
  {
    id: "psy_ch3",
    title: "Chapter 3: Meeting Life Challenges",
    class: "twelfth",
    section: "detailnotes",
    file: "CHAPTER_3_MEETING_LIFE_CHALLENGES.pdf",
    storagePath: "twelfth/detailnotes/CHAPTER_3_MEETING_LIFE_CHALLENGES.pdf",
    isActive: true,
  },
  {
    id: "psy_ch4",
    title: "Chapter 4: Psychological Disorders",
    class: "twelfth",
    section: "detailnotes",
    file: "CHAPTER_4_PSYCHOLOGICAL_DISORDERS.pdf",
    storagePath: "twelfth/detailnotes/CHAPTER_4_PSYCHOLOGICAL_DISORDERS.pdf",
    isActive: true,
  },
  {
    id: "psy_ch5",
    title: "Chapter 5: Therapeutic Approaches",
    class: "twelfth",
    section: "detailnotes",
    file: "CHAPTER_5_THERAPEUTIC_APPROACHES.pdf",
    storagePath: "twelfth/detailnotes/CHAPTER_5_THERAPEUTIC_APPROACHES.pdf",
    isActive: true,
  },
  {
    id: "psy_ch6",
    title: "Chapter 6: Attitude and Social Cognition",
    class: "twelfth",
    section: "detailnotes",
    file: "CHAPTER_6_ATTITUDE_AND_SOCIAL_COGNITION.pdf",
    storagePath: "twelfth/detailnotes/CHAPTER_6_ATTITUDE_AND_SOCIAL_COGNITION.pdf",
    isActive: true,
  },
  {
    id: "psy_ch7",
    title: "Chapter 7: Social Influence and Group Processes",
    class: "twelfth",
    section: "detailnotes",
    file: "CHAPTER_7_SOCIAL_INFLUENCE_AND_GROUP_PROCESSES.pdf",
    storagePath: "twelfth/detailnotes/CHAPTER_7_SOCIAL_INFLUENCE_AND_GROUP_PROCESSES.pdf",
    isActive: true,
  },
];

export const FLASHCARDS_CATALOG: AcademicPdfItem[] = [
  {
    id: "psy_fc_ch1",
    title: "Flashcards – Variations in Psychological Attributes",
    class: "twelfth",
    section: "flashcards",
    file: "CHAPTER_1_FLASHCARDS_FOR_VARIATIONS_IN_PSYCHOLOGICAL_ATTRIBUTES.pdf",
    storagePath: "twelfth/flashcards/CHAPTER_1_FLASHCARDS_FOR_VARIATIONS_IN_PSYCHOLOGICAL_ATTRIBUTES.pdf",
    isActive: true,
  },
  {
    id: "psy_fc_ch2",
    title: "Flashcards – Self and Personality",
    class: "twelfth",
    section: "flashcards",
    file: "CHAPTER_2_FLASHCARDS_FOR_SELF_AND_PERSONALITY.pdf",
    storagePath: "twelfth/flashcards/CHAPTER_2_FLASHCARDS_FOR_SELF_AND_PERSONALITY.pdf",
    isActive: true,
  },
  {
    id: "psy_fc_ch3",
    title: "Flashcards – Meeting Life Challenges",
    class: "twelfth",
    section: "flashcards",
    file: "CHAPTER_3_FLASHCARDS_FOR_MEETING_LIFE_CHALLENGES.pdf",
    storagePath: "twelfth/flashcards/CHAPTER_3_FLASHCARDS_FOR_MEETING_LIFE_CHALLENGES.pdf",
    isActive: true,
  },
  {
    id: "psy_fc_ch4",
    title: "Flashcards – Psychological Disorders",
    class: "twelfth",
    section: "flashcards",
    file: "CHAPTER_4_FLASHCARDS_FOR_PSYCHOLOGICAL_DISORDERS.pdf",
    storagePath: "twelfth/flashcards/CHAPTER_4_FLASHCARDS_FOR_PSYCHOLOGICAL_DISORDERS.pdf",
    isActive: true,
  },
  {
    id: "psy_fc_ch5",
    title: "Flashcards – Therapeutic Approaches",
    class: "twelfth",
    section: "flashcards",
    file: "CHAPTER_5_FLASHCARDS_FOR_THERAPEUTIC_APPROACHES.pdf",
    storagePath: "twelfth/flashcards/CHAPTER_5_FLASHCARDS_FOR_THERAPEUTIC_APPROACHES.pdf",
    isActive: true,
  },
  {
    id: "psy_fc_ch6",
    title: "Flashcards – Attitude and Social Cognition",
    class: "twelfth",
    section: "flashcards",
    file: "CHAPTER_6_FLASHCARDS_FOR_ATTITUDE_AND_SOCIAL_COGNITION.pdf",
    storagePath: "twelfth/flashcards/CHAPTER_6_FLASHCARDS_FOR_ATTITUDE_AND_SOCIAL_COGNITION.pdf",
    isActive: true,
  },
  {
    id: "psy_fc_ch7",
    title: "Flashcards – Social Influence and Group Processes",
    class: "twelfth",
    section: "flashcards",
    file: "CHAPTER_7_FLASHCARDS_FOR_SOCIAL_INFLUENCE_AND_GROUP_PROCESSES.pdf",
    storagePath: "twelfth/flashcards/CHAPTER_7_FLASHCARDS_FOR_SOCIAL_INFLUENCE_AND_GROUP_PROCESSES.pdf",
    isActive: true,
  },
];

export async function syncAllAcademicPdfs(): Promise<{ count: number }> {
  const allItems = [...DETAILED_NOTES_CATALOG, ...FLASHCARDS_CATALOG];
  for (const item of allItems) {
    await setDoc(
      doc(db, "pdfs", item.id),
      {
        title: item.title,
        class: item.class,
        section: item.section,
        storagePath: item.storagePath,
        file: item.file,
        isActive: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
  return { count: allItems.length };
}

export async function getAllFirestorePdfs(): Promise<AcademicPdfItem[]> {
  try {
    const snap = await getDocs(collection(db, "pdfs"));
    if (!snap.empty) {
      return snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || "",
          class: data.class || "twelfth",
          section: data.section || "detailnotes",
          storagePath: data.storagePath || "",
          file: data.file || "",
          isActive: data.isActive ?? true,
        };
      });
    }
  } catch (err) {
    console.warn("Could not fetch pdfs from Firestore, falling back to static catalog:", err);
  }
  return [...DETAILED_NOTES_CATALOG, ...FLASHCARDS_CATALOG];
}
