import { afterEach, describe, expect, it, vi } from "vitest"

import { TOKEN_PATTERN } from "./protocol"
import { getOwnerToken } from "./token"

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe("getOwnerToken", () => {
  it("creates a token once and keeps returning it", () => {
    const token = getOwnerToken()
    expect(token).toMatch(TOKEN_PATTERN)
    expect(getOwnerToken()).toBe(token)
  })

  it("gives each browser a different token", () => {
    const first = getOwnerToken()
    localStorage.clear()
    expect(getOwnerToken()).not.toBe(first)
  })

  it("replaces a malformed stored token", () => {
    localStorage.setItem("andiko:owner-token", "garbage")
    expect(getOwnerToken()).toMatch(TOKEN_PATTERN)
  })

  it("returns null when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError")
    })
    expect(getOwnerToken()).toBeNull()
  })
})
