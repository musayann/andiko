import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createDoc,
  createDraft,
  createFolder,
  deleteDoc,
  deleteFolder,
  duplicateDoc,
  getDoc,
  getDocs,
  getDocWithHistory,
  getLastDocId,
  importFolder,
  isDraft,
  listDocs,
  listFolders,
  resolveStartDoc,
  saveDocContent,
  setLastDocId,
} from "./db"
import { RESUME_COOKIE } from "./site"
import { now } from "./store/contract"
import { indexedDb } from "./store/indexeddb"

// db.ts runs on the IndexedDB store here, as on the web

beforeEach(async () => {
  await Promise.all(indexedDb.tables.map((table) => table.clear()))
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("createDoc", () => {
  it("titles a document after its heading, else the file it came from", async () => {
    const id = await createDoc("# Plans\n\ntext")
    expect(await getDoc(id)).toMatchObject({ id, title: "Plans", content: "# Plans\n\ntext" })
    expect(await getDoc(await createDoc("no heading", "folder", "notes"))).toMatchObject({
      title: "notes",
      folderId: "folder",
      fileName: "notes",
    })
  })

  it("starts empty and outside any folder", async () => {
    const created = await getDoc(await createDoc())
    expect(created).toMatchObject({ title: "Untitled", content: "" })
    expect(created).not.toHaveProperty("folderId")
    expect(created).not.toHaveProperty("fileName")
    expect(created?.createdAt).toBe(created?.updatedAt)
  })
})

describe("drafts", () => {
  it("are stored on their first save, with the editor history", async () => {
    const id = createDraft()
    expect(isDraft(id)).toBe(true)
    expect(await getDoc(id)).toBeUndefined()
    expect(await listDocs()).toEqual([])

    await saveDocContent(id, "# First words", { done: [] })
    expect(isDraft(id)).toBe(false)
    const { doc, history } = await getDocWithHistory(id)
    expect(doc).toMatchObject({ id, title: "First words", content: "# First words" })
    expect(history).toEqual({ id, history: { done: [] }, updatedAt: doc?.updatedAt })
  })

  it("don't bring back a deleted document on a late save", async () => {
    const id = await createDoc("x")
    await deleteDoc(id)
    await saveDocContent(id, "late")
    expect(await getDoc(id)).toBeUndefined()
  })
})

describe("duplicateDoc", () => {
  it("copies a document under a new id", async () => {
    const id = await createDoc("# A", "folder", "a-file")
    const copy = await duplicateDoc(id)
    expect(copy).toBeDefined()
    expect(copy).not.toBe(id)
    expect(await getDoc(copy!)).toMatchObject({ title: "A", content: "# A", folderId: "folder", fileName: "a-file" })
  })

  it("copies nothing for a missing document", async () => {
    expect(await duplicateDoc("missing")).toBeUndefined()
    expect(await listDocs()).toEqual([])
  })
})

describe("folders", () => {
  it("are created at the top level or in another folder", async () => {
    const parent = await createFolder("Work")
    const child = await createFolder("Notes", parent)
    const folders = await listFolders()
    expect(folders.find((folder) => folder.id === parent)).not.toHaveProperty("parentId")
    expect(folders.find((folder) => folder.id === child)).toMatchObject({ name: "Notes", parentId: parent })
  })

  it("keep their documents when deleted, unless asked otherwise", async () => {
    const parent = await createFolder("Work")
    const child = await createFolder("Notes", parent)
    const id = await createDoc("x", child)
    expect(await deleteFolder(child)).toEqual([])
    expect((await getDoc(id))?.folderId).toBe(parent)
    expect(await deleteFolder(parent, { withContents: true })).toEqual([id])
    expect(await getDoc(id)).toBeUndefined()
  })
})

describe("importFolder", () => {
  const vault = {
    name: "Vault",
    docs: [{ fileName: "readme", content: "no heading" }],
    folders: [{ name: "Daily", docs: [{ fileName: "monday", content: "# Monday" }], folders: [] }],
  }

  it("adds the folder tree with its documents", async () => {
    const { folderIds, docIds } = await importFolder(vault)
    const [root, daily] = folderIds
    const folders = await listFolders()
    expect(folders.find((folder) => folder.id === root)).toMatchObject({ name: "Vault" })
    expect(folders.find((folder) => folder.id === root)).not.toHaveProperty("parentId")
    expect(folders.find((folder) => folder.id === daily)).toMatchObject({ name: "Daily", parentId: root })
    expect(await getDocs(docIds)).toMatchObject([
      { title: "readme", fileName: "readme", content: "no heading", folderId: root },
      { title: "Monday", fileName: "monday", content: "# Monday", folderId: daily },
    ])
  })

  it("puts the tree inside an existing folder", async () => {
    const imports = await createFolder("Imports")
    const { folderIds } = await importFolder(vault, imports)
    expect((await listFolders()).find((folder) => folder.id === folderIds[0])?.parentId).toBe(imports)
  })
})

describe("last opened document", () => {
  it("is remembered, and lets the landing page send the visitor back", () => {
    expect(getLastDocId()).toBeNull()
    setLastDocId("abc")
    expect(getLastDocId()).toBe("abc")
    expect(document.cookie).toContain(`${RESUME_COOKIE}=1`)
  })

  it("is forgotten quietly when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError")
    })
    expect(() => setLastDocId("abc")).not.toThrow()
    expect(getLastDocId()).toBeNull()
  })
})

describe("resolveStartDoc", () => {
  const stubWelcome = (response: () => Promise<Response>) => {
    const fetch = vi.fn(response)
    vi.stubGlobal("fetch", fetch)
    return fetch
  }

  it("opens the last opened document", async () => {
    now(1)
    const last = await createDoc("# Last")
    now(2)
    await createDoc("# Newer")
    setLastDocId(last)
    expect(await resolveStartDoc()).toBe(last)
  })

  it("falls back to the last edited document", async () => {
    now(1)
    await createDoc("# Old")
    now(2)
    const recent = await createDoc("# Recent")
    setLastDocId("deleted")
    expect(await resolveStartDoc()).toBe(recent)
  })

  it("starts a first visit with the welcome document", async () => {
    const fetch = stubWelcome(async () => new Response("# Welcome"))
    const id = await resolveStartDoc()
    expect(fetch).toHaveBeenCalledWith("/welcome.md")
    expect(await getDoc(id)).toMatchObject({ title: "Welcome", content: "# Welcome" })
  })

  it("starts empty when the welcome document can't be fetched", async () => {
    stubWelcome(async () => new Response("Not found", { status: 404 }))
    expect((await getDoc(await resolveStartDoc()))?.content).toBe("")

    await Promise.all(indexedDb.tables.map((table) => table.clear()))
    stubWelcome(() => Promise.reject(new TypeError("offline")))
    expect((await getDoc(await resolveStartDoc()))?.content).toBe("")
  })

  it("creates one welcome document for overlapping calls", async () => {
    stubWelcome(async () => new Response("# Welcome"))
    const [first, second] = await Promise.all([resolveStartDoc(), resolveStartDoc()])
    expect(first).toBe(second)
    expect(await listDocs()).toHaveLength(1)
  })
})
