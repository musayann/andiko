import { NextResponse, type NextRequest } from "next/server"

import { themeScript } from "@/lib/theme"

export async function proxy(request: NextRequest) {
  // `/` is the landing page for new visitors and crawlers. Anyone who has opened a
  // document before (RESUME_COOKIE, set in src/lib/db.ts) goes straight back to the editor.
  if (request.nextUrl.pathname === "/") return NextResponse.redirect(new URL("/d", request.url))
  return withSharedPageCsp(request)
}

let themeScriptHash: Promise<string> | undefined

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
}

/**
 * Shared documents (/s/…) render someone else's Markdown on the origin that holds
 * the visitor's own documents and owner token. On top of the sanitizer, a strict
 * CSP lets only Next.js's scripts (marked with this request's nonce) and the
 * root layout's theme script (allowed by hash) run.
 */
async function withSharedPageCsp(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())
  themeScriptHash ??= sha256(themeScript)
  // React needs eval for its development tooling only
  const devEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'sha256-${await themeScriptHash}' 'strict-dynamic'${devEval}`,
    // KaTeX, Mermaid and React style attributes are inline
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data: blob:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ")

  // Next.js reads the nonce from the request's CSP header and adds it to its scripts
  const headers = new Headers(request.headers)
  headers.set("Content-Security-Policy", csp)
  const response = NextResponse.next({ request: { headers } })
  response.headers.set("Content-Security-Policy", csp)
  return response
}

export const config = {
  matcher: [
    // the matcher must be a static literal, so the cookie name is repeated here
    { source: "/", has: [{ type: "cookie", key: "andiko_resume" }] },
    "/s/:path*",
  ],
}
