import { NextResponse, type NextRequest } from "next/server"

// The desktop app loads its UI from the webview's own origin and calls this
// server's /api routes cross-origin. Only those origins are allowed; the API
// authenticates with a bearer token, not cookies, so no credentials are shared.
const DESKTOP_ORIGINS = new Set(["tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"])

function corsHeaders(request: NextRequest): Record<string, string> | null {
  const origin = request.headers.get("origin")
  if (!origin || !DESKTOP_ORIGINS.has(origin)) return null
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  }
}

/** Answers preflights and tags API responses for the desktop app's origin. */
export function withApiCors(request: NextRequest): NextResponse {
  const headers = corsHeaders(request)
  const response = request.method === "OPTIONS" ? new NextResponse(null, { status: 204 }) : NextResponse.next()
  for (const [name, value] of Object.entries(headers ?? {})) response.headers.set(name, value)
  return response
}
