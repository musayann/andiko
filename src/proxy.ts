import { NextResponse, type NextRequest } from "next/server"

// `/` is the landing page for new visitors and crawlers. Anyone who has opened a
// document before (RESUME_COOKIE, set in src/lib/db.ts) goes straight back to the editor.
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL("/d", request.url))
}

export const config = {
  // the matcher must be a static literal, so the cookie name is repeated here
  matcher: [{ source: "/", has: [{ type: "cookie", key: "andiko_resume" }] }],
}
