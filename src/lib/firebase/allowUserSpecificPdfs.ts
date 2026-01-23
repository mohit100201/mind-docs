import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export async function allowUserSpecificPdfs() {
  const userId = "bcEalRONjnMr19pMcYeOzrdkPrk1";

  // ✅ Custom PDF IDs (match pdfs collection document IDs)
  const allowedPdfIds = [
    "psy_ch1",
    "psy_ch2",
    "psy_ch3",
    "psy_ch4",
  ];

  await setDoc(
    doc(db, "users", userId),
    {
      role: "student",
      allowedPdfs: allowedPdfIds,
      updatedAt: serverTimestamp(),
    },
    { merge: true } // ✅ keeps existing user data
  );

  console.log("✅ User allowed exactly 4 PDFs (custom IDs)");
}
