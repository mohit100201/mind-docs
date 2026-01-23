import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/lib/firebase/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

initAdmin();

// export async function GET(
//   req: NextRequest,
//   context: { params: Promise<{ pdfId: string }> }
// ) {
//   try {
//     // ✅ FIX: unwrap params
//     const { pdfId } = await context.params;

//     const authHeader = req.headers.get("authorization");
//     if (!authHeader) {
//       return new NextResponse("Unauthorized", { status: 401 });
//     }

//     const token = authHeader.replace("Bearer ", "");
//     const decoded = await getAuth().verifyIdToken(token);

//     console.log("👤 UID:", decoded.uid);
//     console.log("📄 PDF ID:", pdfId);

//     const db = getFirestore();
//     const userDoc = await db.doc(`users/${decoded.uid}`).get();

//     if (!userDoc.exists) {
//       return new NextResponse("Forbidden", { status: 403 });
//     }

//     const allowed = userDoc.data()?.allowedPdfs || [];
//     if (!allowed.includes(pdfId)) {
//       return new NextResponse("Forbidden", { status: 403 });
//     }

//     const pdfDoc = await db.doc(`pdfs/${pdfId}`).get();
//     if (!pdfDoc.exists) {
//       return new NextResponse("Not Found", { status: 404 });
//     }

//     const storagePath = pdfDoc.data()?.storagePath;
//     const bucket = getStorage().bucket("mind-docs.firebasestorage.app");
// const file = bucket.file(storagePath);

//     const stream = file.createReadStream();

//     return new NextResponse(stream as any, {
//       headers: {
//         "Content-Type": "application/pdf",
//         "Content-Disposition": "inline",
//         "Cache-Control": "no-store",
//       },
//     });
//   } catch (err) {
//     console.error("❌ PDF API ERROR:", err);
//     return new NextResponse("Server Error", { status: 500 });
//   }
// }


export async function GET(
  req: NextRequest,
  context: { params: Promise<{ pdfId: string }> }
) {
  try {
    const { pdfId } = await context.params;

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = await getAuth().verifyIdToken(token);

    console.log("👤 UID:", decoded.uid);
    console.log("📄 PDF ID:", pdfId);

    const db = getFirestore();
    const userDoc = await db.doc(`users/${decoded.uid}`).get();

    if (!userDoc.exists) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const {
      allowedPdfs = [],
      allowedFlashCards = [],
    } = userDoc.data() || {};

    const hasAccess =
      allowedPdfs.includes(pdfId) ||
      allowedFlashCards.includes(pdfId);

    if (!hasAccess) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const pdfDoc = await db.doc(`pdfs/${pdfId}`).get();
    if (!pdfDoc.exists) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const storagePath = pdfDoc.data()?.storagePath;

    // ✅ CORRECT BUCKET
    const bucket = getStorage().bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!);
    const file = bucket.file(storagePath);

    const stream = file.createReadStream();

    return new NextResponse(stream as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("❌ PDF API ERROR:", err);
    return new NextResponse("Server Error", { status: 500 });
  }
}


