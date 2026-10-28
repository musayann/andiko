import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createDoc, createDraft, docsToSync, getDoc, saveDocContent, setDocShare } from "../db"
import { indexedDb } from "../store/indexeddb"
import { publishDoc, syncSharedDocs, unpublishDocs } from "./client"
import { MAX_SHARE_BYTES } from "./protocol"
import { getOwnerToken } from "./token"

vi.mock("sonner", () => ({ toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn() } }))

const SHARE = "abcdefghijkl"
const TOO_LARGE = "x".repeat(MAX_SHARE_BYTES + 1)

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const empty = (status: number) => new Response(null, { status })

function stubFetch(respond: () => Response | Promise<Response>) {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => respond())
  vi.stubGlobal("fetch", fetch)
  return fetch
}

/** A published document whose public copy is behind. */
async function publishedDoc(content: string, shareId = SHARE) {
  const id = await createDoc(content)
  await setDocShare(id, shareId, 0)
  return id
}

beforeEach(async () => {
  await Promise.all(indexedDb.tables.map((table) => table.clear()))
  localStorage.clear()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("publishDoc", () => {
  it("uploads the document and links it to its public copy", async () => {
    const id = await createDoc("# Notes\n\nhello")
    const fetch = stubFetch(() => json({ id: SHARE }, 201))
    expect(await publishDoc(id)).toBe(SHARE)

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe("/api/shares")
    expect(init?.method).toBe("POST")
    expect(init?.headers).toEqual({ Authorization: `Bearer ${getOwnerToken()}`, "Content-Type": "application/json" })
    expect(JSON.parse(init?.body as string)).toEqual({ title: "Notes", content: "# Notes\n\nhello" })

    const doc = await getDoc(id)
    expect(doc).toMatchObject({ shareId: SHARE, syncedAt: doc?.updatedAt })
    expect(await docsToSync()).toEqual([])
  })

  it("returns the public id of a published document without uploading it again", async () => {
    const id = await publishedDoc("# Notes")
    const fetch = stubFetch(() => json({ id: "other" }, 201))
    expect(await publishDoc(id)).toBe(SHARE)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("explains why a document can't be published", async () => {
    const fetch = stubFetch(() => json({ id: SHARE }, 201))
    await expect(publishDoc(createDraft())).rejects.toThrow("Write something before publishing.")
    await expect(publishDoc("missing")).rejects.toThrow("Document not found")
    await expect(publishDoc(await createDoc(TOO_LARGE))).rejects.toThrow("too large to publish")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("passes on what went wrong on the server", async () => {
    const id = await createDoc("# Notes")
    stubFetch(() => json({ error: "You have published too many documents." }, 429))
    await expect(publishDoc(id)).rejects.toThrow("You have published too many documents.")
    stubFetch(() => new Response("Internal error", { status: 500 }))
    await expect(publishDoc(id)).rejects.toThrow("Could not publish the document.")
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")))
    await expect(publishDoc(id)).rejects.toThrow("Could not reach the server.")
    expect((await getDoc(id))?.shareId).toBeUndefined()
  })
})

describe("syncSharedDocs", () => {
  it("pushes the published documents with unsynced edits", async () => {
    const behind = await publishedDoc("# Behind")
    await createDoc("# Private")
    const synced = await createDoc("# Synced")
    await setDocShare(synced, "share-synced", (await getDoc(synced))!.updatedAt)
    const fetch = stubFetch(() => empty(204))

    expect(await syncSharedDocs()).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(`/api/shares/${SHARE}`)
    expect(init?.method).toBe("PUT")
    expect(JSON.parse(init?.body as string)).toEqual({ title: "Behind", content: "# Behind" })
    expect((await getDoc(behind))?.syncedAt).toBe((await getDoc(behind))?.updatedAt)
    expect(await docsToSync()).toEqual([])
  })

  it("leaves edits made during a push for the next sync", async () => {
    const id = await publishedDoc("# Notes")
    const pushed = (await getDoc(id))!.updatedAt
    stubFetch(async () => {
      vi.spyOn(Date, "now").mockReturnValue(pushed + 1000)
      await saveDocContent(id, "# Notes\n\nmore")
      return empty(204)
    })
    expect(await syncSharedDocs()).toBe(true)
    expect((await getDoc(id))?.syncedAt).toBe(pushed)
    expect((await docsToSync()).map((doc) => doc.id)).toEqual([id])
  })

  it("forgets a public copy this browser lost the key to", async () => {
    const id = await publishedDoc("# Notes")
    stubFetch(() => json({ error: "Forbidden" }, 403))
    expect(await syncSharedDocs()).toBe(true)
    expect((await getDoc(id))?.shareId).toBeUndefined()
    expect(toast.warning).toHaveBeenCalledWith("Your edits to “Notes” can’t be published", expect.anything())
  })

  it("forgets a public copy removed on the server", async () => {
    const id = await publishedDoc("# Notes")
    stubFetch(() => json({ error: "Not found" }, 404))
    expect(await syncSharedDocs()).toBe(true)
    expect((await getDoc(id))?.shareId).toBeUndefined()
    expect(toast.warning).toHaveBeenCalledWith("“Notes” is no longer published", expect.anything())
  })

  it("stops and asks to retry when the server fails or can't be reached", async () => {
    await publishedDoc("# A", "share-aaaaaaa")
    await publishedDoc("# B", "share-bbbbbbb")
    const fetch = stubFetch(() => empty(503))
    expect(await syncSharedDocs()).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(await docsToSync()).toHaveLength(2)

    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")))
    expect(await syncSharedDocs()).toBe(false)
    expect(await docsToSync()).toHaveLength(2)
  })

  it("warns once about a document too large to sync, without retrying", async () => {
    const id = await publishedDoc(TOO_LARGE)
    const fetch = stubFetch(() => empty(204))
    expect(await syncSharedDocs()).toBe(true)
    expect(await syncSharedDocs()).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalledTimes(1)
    expect((await getDoc(id))?.shareId).toBe(SHARE)
  })
})

describe("unpublishDocs", () => {
  it("removes the public copies and forgets them", async () => {
    const published = await publishedDoc("# Notes")
    const unpublished = await createDoc("# Private")
    const fetch = stubFetch(() => empty(204))
    expect(await unpublishDocs([published, unpublished, "missing"])).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(`/api/shares/${SHARE}`)
    expect(init?.method).toBe("DELETE")
    expect(init?.headers).toEqual({ Authorization: `Bearer ${getOwnerToken()}` })
    expect((await getDoc(published))?.shareId).toBeUndefined()
  })

  it("counts a copy already removed on the server as removed", async () => {
    const id = await publishedDoc("# Notes")
    stubFetch(() => empty(404))
    expect(await unpublishDocs([id])).toBe(true)
    expect((await getDoc(id))?.shareId).toBeUndefined()
  })

  it("warns that a copy stays public when this browser lost its key", async () => {
    const id = await publishedDoc("# Notes")
    stubFetch(() => empty(403))
    expect(await unpublishDocs([id])).toBe(false)
    expect((await getDoc(id))?.shareId).toBeUndefined()
    expect(toast.warning).toHaveBeenCalledWith("“Notes” is still public", expect.anything())
  })

  it("keeps the link when the server fails, so the user can try again", async () => {
    const id = await publishedDoc("# Notes")
    stubFetch(() => json({ error: "Database unavailable" }, 500))
    await expect(unpublishDocs([id])).rejects.toThrow("Database unavailable")
    expect((await getDoc(id))?.shareId).toBe(SHARE)
  })
})
