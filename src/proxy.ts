import { NextResponse, type NextRequest } from "next/server"

import { withSharedPageSecurity } from "@/lib/security/shared-page-policy"

export function proxy(request: NextRequest) {
  // `/` is the landing page for new visitors and crawlers. Anyone who has opened a
  // document before (RESUME_COOKIE, set in src/lib/db.ts) goes straight back to the editor.
  if (request.nextUrl.pathname === "/") return NextResponse.redirect(new URL("/d", request.url))
  // shared documents get a strict Content Security Policy
  return withSharedPageSecurity(request)
}

export const config = {
  matcher: [
    // the matcher must be a static literal, so the cookie name is repeated here
    { source: "/", has: [{ type: "cookie", key: "andiko_resume" }] },
    "/s/:path*",
  ],
}
