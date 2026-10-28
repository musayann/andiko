import { NextResponse, type NextRequest } from "next/server"

import { withApiCors } from "@/lib/security/cors"
import { withSharedPageSecurity } from "@/lib/security/shared-page-policy"

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) return withApiCors(request)
  // `/` is the landing page for new visitors and crawlers. Anyone who has opened a
  // document before (RESUME_COOKIE, set in packages/core/src/db.ts) goes straight back to the editor.
  if (request.nextUrl.pathname === "/") return NextResponse.redirect(new URL("/d", request.url))
  // shared documents get a strict Content Security Policy
  return withSharedPageSecurity(request)
}

export const config = {
  matcher: [
    // the matcher must be a static literal, so the cookie name is repeated here
    { source: "/", has: [{ type: "cookie", key: "andiko_resume" }] },
    "/s/:path*",
    "/api/:path*",
  ],
}
