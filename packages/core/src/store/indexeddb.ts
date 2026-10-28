import Dexie, { type EntityTable } from "dexie"
import { useLiveQuery } from "dexie-react-hooks"

import { canMoveFolder, descendantIds } from "../folders"
import { getDocTitle } from "../title"
import { needsSync, type Doc, type DocHistory, type Folder, type PublicCopy, type Store } from "./model"

// The website's store: everything stays in this browser's IndexedDB.

const db = new Dexie("andiko") as Dexie & {
  docs: EntityTable<Doc, "id">
  folders: EntityTable<Folder, "id">
  history: EntityTable<DocHistory, "id">
  publicCopies: EntityTable<PublicCopy, "id">
}

db.version(1).stores({ docs: "id, updatedAt" })
// additive only: existing docs have no folderId and simply stay at the top level
db.version(2).stores({ docs: "id, updatedAt, folderId", folders: "id, parentId" })
// fileName is not indexed, so it needs no new version
// additive only: documents without shareId are simply not published
db.version(3).stores({ docs: "id, updatedAt, folderId, shareId" })
// additive only: documents without a history row start with an empty one
db.version(4).stores({ history: "id" })
// additive only: offline cache of public documents opened in the desktop app
db.version(5).stores({ publicCopies: "id" })

/** The IndexedDB database, which the desktop app read its documents from before they moved to SQLite. */
export { db as indexedDb }

export const indexedDbStore: Store = {
  open: async () => {},
  useLiveQuery,

  getSetting: (key) => localStorage.getItem(key),
  setSetting: (key, value) => localStorage.setItem(key, value),

  getDoc: (id) => db.docs.get(id),
  getDocs: (ids) => db.docs.bulkGet(ids),
  listDocs: () => db.docs.orderBy("updatedAt").reverse().toArray(),
  getDocsInFolders: (folderIds) => db.docs.where("folderId").anyOf(folderIds).toArray(),
  docsToSync: () => db.docs.orderBy("shareId").filter(needsSync).toArray(),
  findDocByShareId: (shareId) => db.docs.where("shareId").equals(shareId).first(),
  mostRecentDoc: () => db.docs.orderBy("updatedAt").last(),
  getDocWithHistory: (id) =>
    db.transaction("r", db.docs, db.history, async () => {
      const [doc, history] = await Promise.all([db.docs.get(id), db.history.get(id)])
      return { doc, history }
    }),
  listFolders: () => db.folders.toArray(),
  getPublicCopy: (id) => db.publicCopies.get(id),

  async addDoc(doc) {
    await db.docs.add(doc)
  },

  async saveDocContent(id, content, history, draft) {
    await db.transaction("rw", db.docs, db.history, async () => {
      const updatedAt = Date.now()
      let saved = await db.docs.update(id, (doc) => {
        doc.content = content
        doc.title = getDocTitle(content, doc.fileName)
        doc.updatedAt = updatedAt
      })
      if (!saved && draft) {
        await db.docs.add({ ...draft, createdAt: updatedAt, updatedAt })
        saved = 1
      }
      // a document deleted meanwhile gets no orphaned history
      if (saved && history !== undefined) await db.history.put({ id, history, updatedAt })
    })
  },

  async deleteDoc(id) {
    await db.transaction("rw", db.docs, db.history, async () => {
      await db.docs.delete(id)
      await db.history.delete(id)
    })
  },

  // Dexie deletes a property that is updated to undefined, so moving to the top
  // level removes folderId/parentId instead of storing an unindexable null.

  async moveDoc(id, folderId) {
    await db.docs.update(id, { folderId })
  },

  async setDocShare(id, shareId, syncedAt) {
    await db.docs.update(id, { shareId, syncedAt })
  },

  async markDocSynced(id, shareId, updatedAt) {
    await db.docs.update(id, (doc) => {
      if (doc.shareId === shareId) doc.syncedAt = Math.max(doc.syncedAt ?? 0, updatedAt)
    })
  },

  async clearDocShare(id) {
    await db.docs.update(id, { shareId: undefined, syncedAt: undefined })
  },

  async addFolder(folder) {
    await db.folders.add(folder)
  },

  async renameFolder(id, name) {
    await db.folders.update(id, { name, updatedAt: Date.now() })
  },

  moveFolder: (id, parentId) =>
    db.transaction("rw", db.folders, async () => {
      if (!canMoveFolder(await db.folders.toArray(), id, parentId)) return false
      await db.folders.update(id, { parentId, updatedAt: Date.now() })
      return true
    }),

  deleteFolder: (id, withContents) =>
    db.transaction("rw", db.folders, db.docs, db.history, async () => {
      const folder = await db.folders.get(id)
      if (!folder) return []

      if (!withContents) {
        await db.folders.where("parentId").equals(id).modify({ parentId: folder.parentId })
        await db.docs.where("folderId").equals(id).modify({ folderId: folder.parentId })
        await db.folders.delete(id)
        return []
      }

      const folderIds = [id, ...descendantIds(await db.folders.toArray(), id)]
      const docIds = await db.docs.where("folderId").anyOf(folderIds).primaryKeys()
      await db.docs.bulkDelete(docIds)
      await db.history.bulkDelete(docIds)
      await db.folders.bulkDelete(folderIds)
      return docIds
    }),

  async addTree(folders, docs) {
    await db.transaction("rw", db.folders, db.docs, async () => {
      await db.folders.bulkAdd(folders)
      await db.docs.bulkAdd(docs)
    })
  },

  async putPublicCopy(copy) {
    await db.publicCopies.put(copy)
  },

  async deletePublicCopy(id) {
    await db.publicCopies.delete(id)
  },
}
