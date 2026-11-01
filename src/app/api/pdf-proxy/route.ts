import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Security check: ensure URL belongs to Firebase Storage
  if (
    !url.startsWith("https://firebasestorage.googleapis.com/") &&
    !url.startsWith("https://storage.googleapis.com/")
  ) {
    return NextResponse.json({ error: "Unauthorized target domain" }, { status: 403 });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "application/pdf";
    const data = await response.arrayBuffer();

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      },
    });
  } catch (error) {
    console.error("❌ PDF Proxy Fetch Error:", error);
    return NextResponse.json(
      { error: "Failed to proxy document stream" },
      { status: 500 }
    );
  }
}

