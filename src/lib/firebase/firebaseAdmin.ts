import { initializeApp, getApps, cert } from "firebase-admin/app";

export function initAdmin() {
  if (getApps().length > 0) return true;

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "mind-docs";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (clientEmail && privateKey) {
    try {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, "\n"),
        }),
        storageBucket,
      });
      return true;
    } catch (err) {
      console.warn("Failed to initialize Firebase Admin with cert:", err);
      return false;
    }
  }

  return false;
}
