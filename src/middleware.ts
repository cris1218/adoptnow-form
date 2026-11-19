import { NextRequest, NextResponse } from "next/server";

import {
  clientIpFromHeaders,
  consumeRequestRateLimit,
} from "@/lib/requestRateLimit";

export const config = {
  matcher: ["/api/:path*"],
};

function apiBucket(pathname: string): {
  bucket: string;
  limit: number;
  windowSeconds: number;
} | null {
  if (pathname.startsWith("/api/document-presign")) {
    return { bucket: "api:document-presign", limit: 20, windowSeconds: 60 };
  }
  if (pathname.startsWith("/api/video-presign")) {
    return { bucket: "api:video-presign", limit: 10, windowSeconds: 60 };
  }
  if (
    pathname.startsWith("/api/rifas/webhook") ||
    pathname.startsWith("/api/vaquinhas/webhook") ||
    pathname.startsWith("/api/webhooks/mercadopago")
  ) {
    return { bucket: "api:webhook", limit: 120, windowSeconds: 60 };
  }
  return { bucket: "api:other", limit: 60, windowSeconds: 60 };
}

export async function middleware(request: NextRequest) {
  if (request.method === "GET" || request.method === "HEAD") {
    return NextResponse.next();
  }

  const limits = apiBucket(request.nextUrl.pathname);
  if (!limits) {
    return NextResponse.next();
  }

  const quota = await consumeRequestRateLimit({
    bucket: limits.bucket,
    limit: limits.limit,
    windowSeconds: limits.windowSeconds,
    ip: clientIpFromHeaders(request.headers),
  });

  if (!quota.ok) {
    return NextResponse.json({ error: quota.message }, { status: 429 });
  }

  return NextResponse.next();
}
