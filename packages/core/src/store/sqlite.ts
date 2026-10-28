import { invoke } from "@tauri-apps/api/core"
import Dexie from "dexie"
import { useEffect, useState, useSyncExternalStore } from "react"

import { canMoveFolder, descendantIds } from "../folders"
import { getDocTitle } from "../title"
import { indexedDb } from "./indexeddb"
import { needsSync, type Doc, type DocHistory, type Folder, type PublicCopy, type Store } from "./model"

// The desktop app's store: a SQLite file in Application Support (see
// apps/desktop/src-tauri/src/store.rs), where Time Machine backs it up. Every row but
// the editor histories is also held here in memory: queries read that copy, and a
// write changes it at once, then reaches the file after the writes before it.

type Table = "docs" | "folders" | "history" | "publicCopies" | "settings"

/** Stores `value` under `id`; null deletes the row. */
interface WriteOp {
  table: Table
  id: string
  value: unknown
}

interface Snapshot {
  docs: Doc[]
  folders: Folder[]
  publicCopies: PublicCopy[]
  settings: Record<string, string>
}

// rows are replaced, never changed in place, so queries can hand them out as they are
const docs = new Map<string, Doc>()
const folders = new Map<string, Folder>()
const publicCopies = new Map<string, PublicCopy>()
const settings = new Map<string, string>()
// history is read from the file when a document opens
const inMemory: Partial<Record<Table, Map<string, unknown>>> = { docs, folders, publicCopies, settings }

function fill(snapshot: Snapshot) {
  docs.clear()
  folders.clear()
  publicCopies.clear()
  settings.clear()
  for (const doc of snapshot.docs) docs.set(doc.id, doc)
  for (const folder of snapshot.folders) folders.set(folder.id, folder)
  for (const copy of snapshot.publicCopies) publicCopies.set(copy.id, copy)
  for (const [key, value] of Object.entries(snapshot.settings)) settings.set(key, value)
}

let version = 0
const listeners = new Set<() => void>()

function changed() {
  version++
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

const getVersion = () => version

let queue: Promise<unknown> = Promise.resolve()
let queued = 0
let failed = false

async function reload() {
  const snapshot = await invoke<Snapshot>("store_load")
  // writes made meanwhile aren't in it yet: read it again once they are done
  if (queued > 0) failed = true
  else {
    fill(snapshot)
    changed()
  }
}

/** Applies `ops` to the copy in memory now and to the file in turn; resolves once they are on disk. */
function write(ops: WriteOp[]): Promise<void> {
  if (ops.length === 0) return Promise.resolve()
  for (const { table, id, value } of ops) {
    const rows = inMemory[table]
    if (value === null) rows?.delete(id)
    else rows?.set(id, value)
  }
  // nothing live reads the settings
  if (ops.some((op) => op.table !== "settings")) changed()

  queued++
  const done = queue.then(() => invoke<void>("store_write", { ops }))
  queue = done
    .catch(() => {
      failed = true
    })
    .then(async () => {
      // a failed write left the copy in memory ahead of the file: once no other write
      // is waiting, it is read back from the file
      if (--queued > 0 || !failed) return
      failed = false
      await reload().catch(() => {
        failed = true
      })
    })
  return done
}

interface Rows {
  docs: Doc
  folders: Folder
  history: DocHistory
  publicCopies: PublicCopy
}

const put = <T extends keyof Rows>(table: T, row: Rows[T]): WriteOp => ({ table, id: row.id, value: row })
const remove = (table: Table, id: string): WriteOp => ({ table, id, value: null })

async function updateDoc(id: string, changes: Partial<Doc>) {
  const doc = docs.get(id)
  if (doc) await write([put("docs", { ...doc, ...changes })])
}

const allDocs = () => [...docs.values()]
const allFolders = () => [...folders.values()]

function inFolders(folderIds: string[]): Doc[] {
  const ids = new Set(folderIds)
  return allDocs().filter((doc) => doc.folderId !== undefined && ids.has(doc.folderId))
}

// Earlier versions of the app kept everything in WebKit's storage: IndexedDB, and these
// localStorage keys (see share/token.ts, tabs.ts and db.ts), which are settings now.
const MIGRATED = "andiko:migrated-from-indexeddb"
const LOCAL_SETTINGS = ["andiko:owner-token", "andiko:tabs", "andiko:last-doc"]

/** Copies what is in WebKit's storage into the file, all or nothing. IndexedDB is left as it was. */
async function migrateFromIndexedDb() {
  let ops: WriteOp[] = []
  if (await Dexie.exists(indexedDb.name)) {
    const old = indexedDb
    const [oldDocs, oldFolders, oldHistory, oldCopies] = await old.transaction(
      "r",
      [old.docs, old.folders, old.history, old.publicCopies],
      () => Promise.all([old.docs.toArray(), old.folders.toArray(), old.history.toArray(), old.publicCopies.toArray()]),
    )
    ops = [
      ...oldDocs.map((row) => put("docs", row)),
      ...oldFolders.map((row) => put("folders", row)),
      ...oldHistory.map((row) => put("history", row)),
      ...oldCopies.map((row) => put("publicCopies", row)),
    ]
  }
  for (const key of LOCAL_SETTINGS) {
    const value = localStorage.getItem(key)
    if (value !== null) ops.push({ table: "settings", id: key, value })
  }
  ops.push({ table: "settings", id: MIGRATED, value: String(Date.now()) })
  await write(ops)
}

let opening: Promise<void> | null = null

async function load() {
  fill(await invoke<Snapshot>("store_load"))
  if (!settings.has(MIGRATED)) await migrateFromIndexedDb()
  changed()
}

function useLiveQuery<T>(querier: () => Promise<T> | T, deps: unknown[]): T | undefined {
  const current = useSyncExternalStore(subscribe, getVersion, getVersion)
  const [result, setResult] = useState<T>()
  useEffect(() => {
    let cancelled = false
    Promise.resolve()
      .then(querier)
      .then(
        (value) => {
          if (!cancelled) setResult(value)
        },
        (error: unknown) => console.error(error),
      )
    return () => {
      cancelled = true
    }
    // as with Dexie's, the querier runs again when its deps or the documents change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, ...deps])
  return result
}

export const sqliteStore: Store = {
  open() {
    opening ??= load().catch((error: unknown) => {
      opening = null
      throw error
    })
    return opening
  },
  useLiveQuery,

  getSetting: (key) => settings.get(key) ?? null,
  setSetting(key, value) {
    // kept in memory either way; a failed write is read back from the file (see write)
    if (settings.get(key) !== value) write([{ table: "settings", id: key, value }]).catch(() => undefined)
  },

  getDoc: async (id) => docs.get(id),
  getDocs: async (ids) => ids.map((id) => docs.get(id)),
  listDocs: async () => allDocs().sort((a, b) => b.updatedAt - a.updatedAt),
  getDocsInFolders: async (folderIds) => inFolders(folderIds),
  docsToSync: async () => allDocs().filter(needsSync),
  findDocByShareId: async (shareId) => allDocs().find((doc) => doc.shareId === shareId),
  mostRecentDoc: async () =>
    allDocs().reduce<Doc | undefined>((last, doc) => (last && last.updatedAt >= doc.updatedAt ? last : doc), undefined),
  async getDocWithHistory(id) {
    // after the writes already made, so a history saved just before is on disk
    const history = await queue.then(() => invoke<DocHistory | null>("store_get", { table: "history", id }))
    return { doc: docs.get(id), history: history ?? undefined }
  },
  listFolders: async () => allFolders(),
  getPublicCopy: async (id) => publicCopies.get(id),

  async addDoc(doc) {
    await write([put("docs", doc)])
  },

  async saveDocContent(id, content, history, draft) {
    const updatedAt = Date.now()
    const doc = docs.get(id)
    const saved = doc
      ? { ...doc, content, title: getDocTitle(content, doc.fileName), updatedAt }
      : draft && { ...draft, createdAt: updatedAt, updatedAt }
    // a document deleted meanwhile gets no orphaned history
    if (!saved) return
    const ops = [put("docs", saved)]
    if (history !== undefined) ops.push(put("history", { id, history, updatedAt } satisfies DocHistory))
    await write(ops)
  },

  async deleteDoc(id) {
    await write([remove("docs", id), remove("history", id)])
  },

  moveDoc: (id, folderId) => updateDoc(id, { folderId }),
  setDocShare: (id, shareId, syncedAt) => updateDoc(id, { shareId, syncedAt }),

  async markDocSynced(id, shareId, updatedAt) {
    const doc = docs.get(id)
    if (doc?.shareId === shareId) await updateDoc(id, { syncedAt: Math.max(doc.syncedAt ?? 0, updatedAt) })
  },

  clearDocShare: (id) => updateDoc(id, { shareId: undefined, syncedAt: undefined }),

  async addFolder(folder) {
    await write([put("folders", folder)])
  },

  async renameFolder(id, name) {
    const folder = folders.get(id)
    if (folder) await write([put("folders", { ...folder, name, updatedAt: Date.now() })])
  },

  async moveFolder(id, parentId) {
    if (!canMoveFolder(allFolders(), id, parentId)) return false
    const folder = folders.get(id)
    if (folder) await write([put("folders", { ...folder, parentId, updatedAt: Date.now() })])
    return true
  },

  async deleteFolder(id, withContents) {
    const folder = folders.get(id)
    if (!folder) return []

    if (!withContents) {
      await write([
        ...allFolders()
          .filter((child) => child.parentId === id)
          .map((child) => put("folders", { ...child, parentId: folder.parentId })),
        ...allDocs()
          .filter((doc) => doc.folderId === id)
          .map((doc) => put("docs", { ...doc, folderId: folder.parentId })),
        remove("folders", id),
      ])
      return []
    }

    const folderIds = [id, ...descendantIds(allFolders(), id)]
    const docIds = inFolders(folderIds).map((doc) => doc.id)
    await write([
      ...docIds.flatMap((docId) => [remove("docs", docId), remove("history", docId)]),
      ...folderIds.map((folderId) => remove("folders", folderId)),
    ])
    return docIds
  },

  async addTree(newFolders, newDocs) {
    await write([...newFolders.map((folder) => put("folders", folder)), ...newDocs.map((doc) => put("docs", doc))])
  },

  async putPublicCopy(copy) {
    await write([put("publicCopies", copy)])
  },

  async deletePublicCopy(id) {
    await write([remove("publicCopies", id)])
  },
}
