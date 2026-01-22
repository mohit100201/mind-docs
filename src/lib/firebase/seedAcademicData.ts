import { db } from "@/lib/firebase/firebase";
import {
  doc,
  setDoc,
  collection,
} from "firebase/firestore";

export async function seedAcademicData() {
  /* ================= CLASS 11 ================= */

  await setDoc(doc(db, "classes", "class-11"), {
    title: "Class 11 Psychology",
    category: "Foundation Academic",
  });

  const class11Folders = collection(db, "classes", "class-11", "subFolders");

  await setDoc(doc(class11Folders, "detailed-notes"), {
    title: "Detailed Notes",
    access: {
      free: false,
      premium: true,
      teacher: true,
      admin: true,
    },
    files: [
      {
        name: "What_is_Psychology_Ch1.pdf",
        size: "1.2MB",
        url: "",
      },
      {
        name: "Methods_of_Enquiry_Ch2.pdf",
        size: "2.4MB",
        url: "",
      },
    ],
  });

  await setDoc(doc(class11Folders, "flowcharts"), {
    title: "Flowcharts",
    access: {
      free: false,
      premium: true,
      teacher: true,
      admin: true,
    },
    files: [
      {
        name: "Human_Development_Visual.pdf",
        size: "0.8MB",
        url: "",
      },
      {
        name: "Sensory_Attentional_Processes.pdf",
        size: "1.1MB",
        url: "",
      },
    ],
  });

  /* ================= CLASS 12 ================= */

  await setDoc(doc(db, "classes", "class-12"), {
    title: "Class 12 Psychology",
    category: "Board Excellence",
  });

  const class12Folders = collection(db, "classes", "class-12", "subFolders");

  await setDoc(doc(class12Folders, "detailed-notes"), {
    title: "Detailed Notes",
    access: {
      free: true,
      premium: true,
      teacher: true,
      admin: true,
    },
    files: [
      {
        name: "Self_and_Personality.pdf",
        size: "2.5MB",
        url: "",
      },
      {
        name: "Psychological_Disorders.pdf",
        size: "3.2MB",
        url: "",
      },
    ],
  });

  await setDoc(doc(class12Folders, "flashcards"), {
    title: "Flashcards",
    access: {
      free: true,
      premium: true,
      teacher: true,
      admin: true,
    },
    files: [
      {
        name: "Therapeutic_Approaches_Recall.pdf",
        size: "1.5MB",
        url: "",
      },
    ],
  });

  await setDoc(doc(class12Folders, "mcq-practice"), {
    title: "MCQ Practice",
    access: {
      free: false,
      premium: false,
      teacher: true,
      admin: true,
    },
    files: [],
  });

  await setDoc(doc(class12Folders, "case-base-practice"), {
    title: "Case Base Practice",
    access: {
      free: false,
      premium: false,
      teacher: true,
      admin: true,
    },
    files: [],
  });

  console.log("✅ Academic data seeded successfully");
}
