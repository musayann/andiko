import { NextResponse, type NextRequest } from "next/server"

import { themeScript } from "@/lib/theme"

// Shared documents (/s/…) render someone else's Markdown on the origin that holds
// the visitor's own documents and owner token. On top of the sanitizer, a strict
// Content Security Policy lets only Next.js's scripts (marked with a per-request
// nonce) and the root layout's theme script (allowed by hash) run.

let themeScriptHash: Promise<string> | undefined

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
}

async function sharedPagePolicy(nonce: string): Promise<string> {
  themeScriptHash ??= sha256(themeScript)
  // React needs eval for its development tooling only
  const devEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
  return [
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
}

/**
 * Continues the request with a fresh nonce-based Content Security Policy. The
 * page must render per request for the nonce to apply.
 */
export async function withSharedPageSecurity(request: NextRequest): Promise<NextResponse> {
  const policy = await sharedPagePolicy(btoa(crypto.randomUUID()))

  // Next.js reads the nonce from the request's policy header and adds it to its scripts
  const headers = new Headers(request.headers)
  headers.set("Content-Security-Policy", policy)
  const response = NextResponse.next({ request: { headers } })
  response.headers.set("Content-Security-Policy", policy)
  return response
}
