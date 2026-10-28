import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getPublicCopy, putPublicCopy, type PublicCopy } from "../db"
import { now } from "../store/contract"
import { indexedDb } from "../store/indexeddb"
import { loadPublicCopy, parseAndikoLink, parseShareInput } from "./public"

const ID = "abcdefghijkl"

describe("loadPublicCopy", () => {
  const BODY = { id: ID, title: "Notes", content: "# Notes", updatedAt: "2026-01-02T03:04:05.000Z" }
  const SAVED: PublicCopy = { ...BODY, content: "# Older", fetchedAt: 1 }

  function stubFetch(respond: () => Promise<Response>) {
    const fetch = vi.fn(respond)
    vi.stubGlobal("fetch", fetch)
    return fetch
  }

  beforeEach(() => indexedDb.publicCopies.clear())

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("fetches the public copy and keeps it for offline use", async () => {
    const fetch = stubFetch(async () => new Response(JSON.stringify(BODY)))
    now(1234)
    const copy = { ...BODY, fetchedAt: 1234 }
    expect(await loadPublicCopy(ID)).toEqual({ status: "ok", copy, offline: false })
    expect(fetch).toHaveBeenCalledWith(`/api/shares/${ID}`)
    expect(await getPublicCopy(ID)).toEqual(copy)
  })

  it("forgets a copy that was removed", async () => {
    await putPublicCopy(SAVED)
    stubFetch(async () => new Response(null, { status: 404 }))
    expect(await loadPublicCopy(ID)).toEqual({ status: "missing" })
    expect(await getPublicCopy(ID)).toBeUndefined()
  })

  it("falls back to the saved copy when the server can't be reached or fails", async () => {
    await putPublicCopy(SAVED)
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")))
    expect(await loadPublicCopy(ID)).toEqual({ status: "ok", copy: SAVED, offline: true })
    stubFetch(async () => new Response(null, { status: 503 }))
    expect(await loadPublicCopy(ID)).toEqual({ status: "ok", copy: SAVED, offline: true })
    expect(await getPublicCopy(ID)).toEqual(SAVED)
  })

  it("is unavailable offline without a saved copy", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")))
    expect(await loadPublicCopy(ID)).toEqual({ status: "unavailable" })
  })
})

describe("parseShareInput", () => {
  it("reads the id from public links, slugs and bare ids", () => {
    expect(parseShareInput(`https://andiko.app/s/my-notes-${ID}`)).toBe(ID)
    expect(parseShareInput(`https://andiko.app/s/${ID}`)).toBe(ID)
    expect(parseShareInput(`andiko://s/my-notes-${ID}`)).toBe(ID)
    expect(parseShareInput(`  my-notes-${ID} `)).toBe(ID)
    expect(parseShareInput(ID)).toBe(ID)
  })

  it("reads the public id from an editor link", () => {
    expect(parseShareInput(`https://andiko.app/d/localdoc01?share=${ID}`)).toBe(ID)
  })

  it("rejects anything else", () => {
    expect(parseShareInput("")).toBeNull()
    expect(parseShareInput("https://example.com/about")).toBeNull()
    expect(parseShareInput("hello")).toBeNull()
  })
})

describe("parseAndikoLink", () => {
  it("opens public links on the site and in the app's scheme", () => {
    const link = { kind: "public", shareId: ID }
    expect(parseAndikoLink(`https://andiko.app/s/my-notes-${ID}`)).toEqual(link)
    expect(parseAndikoLink(`https://www.andiko.app/s/${ID}?utm_source=x#intro`)).toEqual(link)
    expect(parseAndikoLink(`andiko://s/my-notes-${ID}`)).toEqual(link)
    expect(parseAndikoLink(`andiko:///s/my-notes-${ID}`)).toEqual(link)
  })

  it("opens editor links, with the public copy they name", () => {
    expect(parseAndikoLink("https://andiko.app/d/localdoc01")).toEqual({ kind: "doc", docId: "localdoc01" })
    expect(parseAndikoLink(`andiko://d/localdoc01?share=${ID}`)).toEqual({
      kind: "doc",
      docId: "localdoc01",
      shareId: ID,
    })
    expect(parseAndikoLink("https://andiko.app/d/localdoc01?share=bad")).toEqual({ kind: "doc", docId: "localdoc01" })
  })

  it("leaves other links alone", () => {
    expect(parseAndikoLink(`https://example.com/s/my-notes-${ID}`)).toBeNull()
    expect(parseAndikoLink(`https://andiko.app.example.com/s/${ID}`)).toBeNull()
    expect(parseAndikoLink(`mailto:someone@andiko.app`)).toBeNull()
    expect(parseAndikoLink("https://andiko.app/")).toBeNull()
    expect(parseAndikoLink("https://andiko.app/privacy")).toBeNull()
    expect(parseAndikoLink("https://andiko.app/s/hello")).toBeNull()
    expect(parseAndikoLink(`https://andiko.app/s/${ID}/extra`)).toBeNull()
    expect(parseAndikoLink("andiko://")).toBeNull()
    expect(parseAndikoLink("not a link")).toBeNull()
  })
})
