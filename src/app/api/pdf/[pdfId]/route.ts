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
    const adminInitialized = initAdmin();
    if (!adminInitialized) {
      return NextResponse.json(
        { error: "Firebase Admin is not configured. PDFs load directly via client SDK." },
        { status: 501 }
      );
    }

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

    const userData = userDoc.data() || {};
    const adminEmail = (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || "mohitkhandelwal9784@gmail.com").toLowerCase();
    const isAdmin =
      userData.role === "admin" ||
      decoded.email?.toLowerCase() === adminEmail;

    const {
      allowedPdfs = [],
      allowedFlashCards = [],
    } = userData;

    if (!isAdmin && !allowedPdfs.includes(pdfId) && !allowedFlashCards.includes(pdfId)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // 📄 Get PDF doc
    const pdfDoc = await db.doc(`pdfs/${pdfId}`).get();
    if (!pdfDoc.exists) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const storagePath = pdfDoc.data()?.storagePath;

    // ✅ Generate SIGNED URL (mobile safe)
    const storageBucket =
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const bucket = getStorage().bucket(storageBucket!);
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
