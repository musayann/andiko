// @vitest-environment node
import { createHash } from "node:crypto"
import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"

import { themeScript } from "@andiko/core/theme"

import { proxy } from "./proxy"

const DESKTOP_ORIGINS = ["tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"]

const request = (path: string, { method = "GET", origin }: { method?: string; origin?: string } = {}) =>
  new NextRequest(`https://andiko.app${path}`, { method, headers: origin ? { origin } : {} })

describe("API requests", () => {
  it("allow the desktop app's origins", async () => {
    for (const origin of DESKTOP_ORIGINS) {
      const { headers } = await proxy(request("/api/shares", { method: "POST", origin }))
      expect(headers.get("access-control-allow-origin")).toBe(origin)
      expect(headers.get("access-control-allow-headers")).toBe("Authorization, Content-Type")
      expect(headers.get("vary")).toBe("Origin")
      expect(headers.get("x-middleware-next")).toBe("1")
    }
  })

  it("give other origins no CORS headers", async () => {
    for (const origin of ["https://example.com", "tauri://localhost.example.com", undefined]) {
      const { headers } = await proxy(request("/api/shares", { method: "POST", origin }))
      expect(headers.get("access-control-allow-origin")).toBeNull()
      expect(headers.get("access-control-allow-methods")).toBeNull()
    }
  })

  it("answer preflights", async () => {
    const response = await proxy(request("/api/shares/abcdefghijkl", { method: "OPTIONS", origin: DESKTOP_ORIGINS[0] }))
    expect(response.status).toBe(204)
    expect(response.headers.get("access-control-allow-methods")).toBe("GET, POST, PUT, DELETE, OPTIONS")
    expect(response.headers.get("x-middleware-next")).toBeNull()
  })
})

it("sends returning visitors from the landing page to the editor", async () => {
  const response = await proxy(request("/"))
  expect(response.status).toBe(307)
  expect(response.headers.get("location")).toBe("https://andiko.app/d")
})

describe("shared documents", () => {
  const policy = async () => {
    const { headers } = await proxy(request("/s/notes-abcdefghijkl"))
    return headers.get("content-security-policy")!
  }
  const nonce = (csp: string) => /'nonce-([^']+)'/.exec(csp)?.[1]

  it("get a strict Content Security Policy with a fresh nonce", async () => {
    const first = await policy()
    const second = await policy()
    expect(nonce(first)).toBeTruthy()
    expect(nonce(first)).not.toBe(nonce(second))
    for (const directive of ["object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "'strict-dynamic'"]) {
      expect(first).toContain(directive)
    }
    expect(first).not.toContain("unsafe-eval")
  })

  it("allow the theme script by its hash", async () => {
    const hash = createHash("sha256").update(themeScript).digest("base64")
    expect(await policy()).toContain(`'sha256-${hash}'`)
  })

  it("hand the policy to Next.js, which adds the nonce to its scripts", async () => {
    const { headers } = await proxy(request("/s/notes-abcdefghijkl"))
    expect(headers.get("x-middleware-request-content-security-policy")).toBe(headers.get("content-security-policy"))
  })
})
