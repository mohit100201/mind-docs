import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/lib/firebase/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

initAdmin();

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ pdfId: string }> }
) {
  try {
    const { pdfId } = await context.params;

    // 🔐 Auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = await getAuth().verifyIdToken(token);

    // 🔎 Check user permissions
    const db = getFirestore();
    const userDoc = await db.doc(`users/${decoded.uid}`).get();

    if (!userDoc.exists) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const {
      allowedPdfs = [],
      allowedFlashCards = [],
    } = userDoc.data() || {};

    if (!allowedPdfs.includes(pdfId) && !allowedFlashCards.includes(pdfId)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // 📄 Get PDF doc
    const pdfDoc = await db.doc(`pdfs/${pdfId}`).get();
    if (!pdfDoc.exists) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const storagePath = pdfDoc.data()?.storagePath;

    // ✅ Generate SIGNED URL (mobile safe)
    const bucket = getStorage().bucket(
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!
    );
    const file = bucket.file(storagePath);

    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    return NextResponse.json({ url: signedUrl });
  } catch (err) {
    console.error("❌ PDF API ERROR:", err);
    return new NextResponse("Server Error", { status: 500 });
  }
}
