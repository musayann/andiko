import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Doc, Folder, PublicCopy, Store } from "./model"

// What every Store must do, run against each of them (indexeddb.test.ts, sqlite.test.ts)
// so the web and the desktop app keep behaving the same.

export const doc = (id: string, changes: Partial<Doc> = {}): Doc => ({
  id,
  title: id.toUpperCase(),
  content: `# ${id.toUpperCase()}`,
  createdAt: 1,
  updatedAt: 1,
  ...changes,
})

export const folder = (id: string, name: string, parentId?: string): Folder => ({
  id,
  name,
  ...(parentId && { parentId }),
  createdAt: 1,
  updatedAt: 1,
})

/** Sets what Date.now() returns from here on. */
export const now = (ms: number) => vi.spyOn(Date, "now").mockReturnValue(ms)

const ids = (rows: { id: string }[]) => rows.map((row) => row.id)

/** Runs the shared Store tests; `setup` returns a ready, empty store and is called before each test. */
export function describeStoreContract(name: string, setup: () => Promise<Store>) {
  describe(`${name} store`, () => {
    let store: Store

    beforeEach(async () => {
      store = await setup()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    describe("settings", () => {
      it("reads back what was set, and null for unknown keys", () => {
        expect(store.getSetting("andiko:test")).toBeNull()
        store.setSetting("andiko:test", "a")
        store.setSetting("andiko:test", "b")
        expect(store.getSetting("andiko:test")).toBe("b")
      })
    })

    describe("reading documents", () => {
      it("gets documents by id, in the order asked", async () => {
        await store.addDoc(doc("a"))
        await store.addDoc(doc("b"))
        expect(await store.getDoc("a")).toEqual(doc("a"))
        expect(await store.getDoc("missing")).toBeUndefined()
        expect(await store.getDocs(["b", "missing", "a"])).toEqual([doc("b"), undefined, doc("a")])
      })

      it("lists documents last edited first", async () => {
        expect(await store.listDocs()).toEqual([])
        expect(await store.mostRecentDoc()).toBeUndefined()
        await store.addDoc(doc("old", { updatedAt: 1 }))
        await store.addDoc(doc("new", { updatedAt: 3 }))
        await store.addDoc(doc("mid", { updatedAt: 2 }))
        expect(ids(await store.listDocs())).toEqual(["new", "mid", "old"])
        expect((await store.mostRecentDoc())?.id).toBe("new")
      })

      it("gets the documents of some folders", async () => {
        await store.addDoc(doc("a", { folderId: "f1" }))
        await store.addDoc(doc("b", { folderId: "f2" }))
        await store.addDoc(doc("c", { folderId: "f3" }))
        await store.addDoc(doc("d"))
        expect(ids(await store.getDocsInFolders(["f1", "f2"])).sort()).toEqual(["a", "b"])
        expect(await store.getDocsInFolders([])).toEqual([])
      })

      it("finds a document by its public id", async () => {
        await store.addDoc(doc("a", { shareId: "share-a", syncedAt: 1 }))
        await store.addDoc(doc("b"))
        expect((await store.findDocByShareId("share-a"))?.id).toBe("a")
        expect(await store.findDocByShareId("share-x")).toBeUndefined()
      })
    })

    describe("saveDocContent", () => {
      it("saves new content with its title and edit time", async () => {
        await store.addDoc(doc("a"))
        now(5000)
        await store.saveDocContent("a", "# Renamed\n\ntext")
        expect(await store.getDoc("a")).toEqual(
          doc("a", { title: "Renamed", content: "# Renamed\n\ntext", updatedAt: 5000 }),
        )
      })

      it("titles content without a heading after the file it came from, else Untitled", async () => {
        await store.addDoc(doc("a", { fileName: "notes" }))
        await store.addDoc(doc("b"))
        await store.saveDocContent("a", "plain text")
        await store.saveDocContent("b", "plain text")
        expect((await store.getDoc("a"))?.title).toBe("notes")
        expect((await store.getDoc("b"))?.title).toBe("Untitled")
      })

      it("keeps the editor history with the edit time it belongs to", async () => {
        await store.addDoc(doc("a"))
        now(5000)
        await store.saveDocContent("a", "one", { done: [1] })
        expect(await store.getDocWithHistory("a")).toEqual({
          doc: doc("a", { title: "Untitled", content: "one", updatedAt: 5000 }),
          history: { id: "a", history: { done: [1] }, updatedAt: 5000 },
        })

        // saved without a history: the stored one stays, and no longer matches the document
        now(6000)
        await store.saveDocContent("a", "two")
        const { doc: saved, history } = await store.getDocWithHistory("a")
        expect(saved?.updatedAt).toBe(6000)
        expect(history).toEqual({ id: "a", history: { done: [1] }, updatedAt: 5000 })
      })

      it("adds a draft on its first save", async () => {
        now(5000)
        const draft = doc("d", { title: "Draft", content: "# Draft" })
        await store.saveDocContent("d", "# Draft", { done: [] }, draft)
        expect(await store.getDocWithHistory("d")).toEqual({
          doc: { ...draft, createdAt: 5000, updatedAt: 5000 },
          history: { id: "d", history: { done: [] }, updatedAt: 5000 },
        })
      })

      it("leaves a document deleted meanwhile deleted, without history", async () => {
        await store.saveDocContent("gone", "late", { done: [] })
        const { doc: saved, history } = await store.getDocWithHistory("gone")
        expect(saved).toBeUndefined()
        expect(history).toBeUndefined()
      })
    })

    it("deletes a document with its history", async () => {
      await store.addDoc(doc("a"))
      await store.addDoc(doc("b"))
      await store.saveDocContent("a", "x", { done: [] })
      await store.deleteDoc("a")
      const { doc: deleted, history } = await store.getDocWithHistory("a")
      expect(deleted).toBeUndefined()
      expect(history).toBeUndefined()
      expect(ids(await store.listDocs())).toEqual(["b"])
    })

    it("moves a document between folders without changing its edit time", async () => {
      await store.addDoc(doc("a", { updatedAt: 7 }))
      await store.moveDoc("a", "f1")
      expect(await store.getDoc("a")).toEqual(doc("a", { folderId: "f1", updatedAt: 7 }))
      expect(ids(await store.getDocsInFolders(["f1"]))).toEqual(["a"])

      await store.moveDoc("a", undefined)
      expect((await store.getDoc("a"))?.folderId).toBeUndefined()
      expect((await store.getDoc("a"))?.updatedAt).toBe(7)
      expect(await store.getDocsInFolders(["f1"])).toEqual([])
    })

    describe("publishing", () => {
      it("tracks which published documents have edits to push", async () => {
        await store.addDoc(doc("a", { updatedAt: 10 }))
        await store.addDoc(doc("b", { updatedAt: 10 }))
        await store.setDocShare("a", "share-a", 10)
        expect(await store.getDoc("a")).toMatchObject({ shareId: "share-a", syncedAt: 10 })
        expect(await store.docsToSync()).toEqual([])

        now(20)
        await store.saveDocContent("a", "edited")
        await store.saveDocContent("b", "edited")
        expect(ids(await store.docsToSync())).toEqual(["a"])

        await store.markDocSynced("a", "share-a", 20)
        expect((await store.getDoc("a"))?.syncedAt).toBe(20)
        expect(await store.docsToSync()).toEqual([])
      })

      it("never moves the synced time back", async () => {
        await store.addDoc(doc("a", { updatedAt: 30 }))
        await store.setDocShare("a", "share-a", 30)
        await store.markDocSynced("a", "share-a", 20)
        expect((await store.getDoc("a"))?.syncedAt).toBe(30)
      })

      it("ignores a push to a public copy the document no longer has", async () => {
        await store.addDoc(doc("a", { updatedAt: 10 }))
        await store.setDocShare("a", "share-new", 5)
        await store.markDocSynced("a", "share-old", 10)
        expect((await store.getDoc("a"))?.syncedAt).toBe(5)

        await store.clearDocShare("a")
        await store.markDocSynced("a", "share-new", 10)
        expect(await store.getDoc("a")).toEqual(doc("a", { updatedAt: 10 }))
      })

      it("forgets the public copy when unpublished", async () => {
        await store.addDoc(doc("a", { updatedAt: 10 }))
        await store.setDocShare("a", "share-a", 0)
        expect(ids(await store.docsToSync())).toEqual(["a"])

        await store.clearDocShare("a")
        const unpublished = await store.getDoc("a")
        expect(unpublished?.shareId).toBeUndefined()
        expect(unpublished?.syncedAt).toBeUndefined()
        expect(await store.findDocByShareId("share-a")).toBeUndefined()
        expect(await store.docsToSync()).toEqual([])
      })
    })

    describe("folders", () => {
      // work
      // └── notes
      //     └── drafts
      // personal
      async function addFolders() {
        await store.addTree(
          [
            folder("work", "Work"),
            folder("notes", "Notes", "work"),
            folder("drafts", "Drafts", "notes"),
            folder("personal", "Personal"),
          ],
          [
            doc("in-work", { folderId: "work" }),
            doc("in-notes", { folderId: "notes" }),
            doc("in-drafts", { folderId: "drafts" }),
            doc("in-personal", { folderId: "personal" }),
            doc("top"),
          ],
        )
        await store.saveDocContent("in-notes", "x", { done: [] })
      }

      const parents = async () =>
        Object.fromEntries((await store.listFolders()).map((folder) => [folder.id, folder.parentId]))

      it("adds, lists and renames folders", async () => {
        await store.addFolder(folder("f", "Work"))
        expect(await store.listFolders()).toEqual([folder("f", "Work")])

        now(5000)
        await store.renameFolder("f", "Projects")
        await store.renameFolder("missing", "Nothing")
        expect(await store.listFolders()).toEqual([{ ...folder("f", "Projects"), updatedAt: 5000 }])
      })

      it("adds a tree of folders and documents", async () => {
        await addFolders()
        expect(await parents()).toEqual({ work: undefined, notes: "work", drafts: "notes", personal: undefined })
        expect(ids(await store.getDocsInFolders(["drafts"]))).toEqual(["in-drafts"])
      })

      it("moves a folder, but never into itself or its own subfolders", async () => {
        await addFolders()
        expect(await store.moveFolder("work", "work")).toBe(false)
        expect(await store.moveFolder("work", "drafts")).toBe(false)
        expect(await parents()).toEqual({ work: undefined, notes: "work", drafts: "notes", personal: undefined })

        now(5000)
        expect(await store.moveFolder("drafts", "personal")).toBe(true)
        expect(await store.moveFolder("notes", undefined)).toBe(true)
        expect(await parents()).toEqual({ work: undefined, notes: undefined, drafts: "personal", personal: undefined })
        expect((await store.listFolders()).find((folder) => folder.id === "drafts")?.updatedAt).toBe(5000)
      })

      it("deletes a folder, moving its documents and subfolders up one level", async () => {
        await addFolders()
        expect(await store.deleteFolder("notes", false)).toEqual([])
        expect(await parents()).toEqual({ work: undefined, drafts: "work", personal: undefined })
        expect((await store.getDoc("in-notes"))?.folderId).toBe("work")
        expect((await store.getDoc("in-drafts"))?.folderId).toBe("drafts")

        expect(await store.deleteFolder("work", false)).toEqual([])
        expect(await parents()).toEqual({ drafts: undefined, personal: undefined })
        expect((await store.getDoc("in-work"))?.folderId).toBeUndefined()
        expect((await store.getDoc("in-notes"))?.folderId).toBeUndefined()
        expect((await store.getDocWithHistory("in-notes")).history).toBeDefined()
      })

      it("deletes a folder with everything in it", async () => {
        await addFolders()
        expect((await store.deleteFolder("work", true)).sort()).toEqual(["in-drafts", "in-notes", "in-work"])
        expect(await parents()).toEqual({ personal: undefined })
        expect(ids(await store.listDocs()).sort()).toEqual(["in-personal", "top"])
        expect((await store.getDocWithHistory("in-notes")).history).toBeUndefined()
      })

      it("deletes nothing for a missing folder", async () => {
        await addFolders()
        expect(await store.deleteFolder("missing", false)).toEqual([])
        expect(await store.deleteFolder("missing", true)).toEqual([])
        expect(await store.listFolders()).toHaveLength(4)
        expect(await store.listDocs()).toHaveLength(5)
      })
    })

    it("keeps, replaces and deletes public copies", async () => {
      const copy: PublicCopy = {
        id: "abcdefghijkl",
        title: "Notes",
        content: "# Notes",
        updatedAt: "2026-01-02T03:04:05.000Z",
        fetchedAt: 1,
      }
      expect(await store.getPublicCopy(copy.id)).toBeUndefined()
      await store.putPublicCopy(copy)
      expect(await store.getPublicCopy(copy.id)).toEqual(copy)
      await store.putPublicCopy({ ...copy, content: "# Newer", fetchedAt: 2 })
      expect(await store.getPublicCopy(copy.id)).toEqual({ ...copy, content: "# Newer", fetchedAt: 2 })
      await store.deletePublicCopy(copy.id)
      expect(await store.getPublicCopy(copy.id)).toBeUndefined()
    })
  })
}
