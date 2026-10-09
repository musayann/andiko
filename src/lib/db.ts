import Dexie, { type EntityTable } from "dexie"
import { nanoid } from "nanoid"

import type { ImportFolder } from "./archive"
import { canMoveFolder, descendantIds } from "./folders"
import { RESUME_COOKIE } from "./site"
import { getDocTitle } from "./title"

export interface Doc {
  id: string
  title: string
  content: string
  /** Absent for documents outside any folder, which includes every document created before folders existed. */
  folderId?: string
  /** Name (without extension) of the file it was imported from; the title when the content has none. */
  fileName?: string
  /** Public id of the published copy at /s/{shareId}; absent while the document is private. */
  shareId?: string
  /** The `updatedAt` last pushed to the published copy; edits after it are still to sync. */
  syncedAt?: number
  createdAt: number
  updatedAt: number
}

export interface Folder {
  id: string
  name: string
  /** Absent for top-level folders. */
  parentId?: string
  createdAt: number
  updatedAt: number
}

const db = new Dexie("andiko") as Dexie & {
  docs: EntityTable<Doc, "id">
  folders: EntityTable<Folder, "id">
}

db.version(1).stores({ docs: "id, updatedAt" })
// additive only: existing docs have no folderId and simply stay at the top level
db.version(2).stores({ docs: "id, updatedAt, folderId", folders: "id, parentId" })
// fileName is not indexed, so it needs no new version
// additive only: documents without shareId are simply not published
db.version(3).stores({ docs: "id, updatedAt, folderId, shareId" })

export { db }

const LAST_DOC_KEY = "andiko:last-doc"

function newDoc(content: string, folderId?: string, fileName?: string): Doc {
  const now = Date.now()
  return {
    id: nanoid(10),
    title: getDocTitle(content, fileName),
    content,
    ...(folderId && { folderId }),
    ...(fileName && { fileName }),
    createdAt: now,
    updatedAt: now,
  }
}

export async function createDoc(content = "", folderId?: string, fileName?: string): Promise<string> {
  return db.docs.add(newDoc(content, folderId, fileName))
}

export async function saveDocContent(id: string, content: string) {
  await db.docs.update(id, (doc) => {
    doc.content = content
    doc.title = getDocTitle(content, doc.fileName)
    doc.updatedAt = Date.now()
  })
}

export async function duplicateDoc(id: string): Promise<string | undefined> {
  const doc = await db.docs.get(id)
  return doc ? createDoc(doc.content, doc.folderId, doc.fileName) : undefined
}

export async function deleteDoc(id: string) {
  await db.docs.delete(id)
}

// Dexie deletes a property that is updated to undefined, so moving to the top
// level removes folderId/parentId instead of storing an unindexable null.

/** Moves a document into a folder, or to the top level. Leaves updatedAt alone: it tracks content edits. */
export async function moveDoc(id: string, folderId?: string) {
  await db.docs.update(id, { folderId })
}

/** True when a published document has edits its public copy doesn't have yet. */
export const needsSync = (doc: Doc) => doc.shareId !== undefined && doc.updatedAt > (doc.syncedAt ?? 0)

export async function setDocShare(id: string, shareId: string, syncedAt: number) {
  await db.docs.update(id, { shareId, syncedAt })
}

/** Records a push of the version saved at `updatedAt`, unless the document was unpublished or republished meanwhile. */
export async function markDocSynced(id: string, shareId: string, updatedAt: number) {
  await db.docs.update(id, (doc) => {
    if (doc.shareId === shareId) doc.syncedAt = Math.max(doc.syncedAt ?? 0, updatedAt)
  })
}

export async function clearDocShare(id: string) {
  await db.docs.update(id, { shareId: undefined, syncedAt: undefined })
}

export async function createFolder(name: string, parentId?: string): Promise<string> {
  const now = Date.now()
  const id = nanoid(10)
  await db.folders.add({ id, name, ...(parentId && { parentId }), createdAt: now, updatedAt: now })
  return id
}

export async function renameFolder(id: string, name: string) {
  await db.folders.update(id, { name, updatedAt: Date.now() })
}

/** Moves a folder under another folder, or to the top level. Returns false for a move into itself or its own subfolders. */
export async function moveFolder(id: string, parentId?: string): Promise<boolean> {
  return db.transaction("rw", db.folders, async () => {
    if (!canMoveFolder(await db.folders.toArray(), id, parentId)) return false
    await db.folders.update(id, { parentId, updatedAt: Date.now() })
    return true
  })
}

/**
 * Deletes a folder. By default its documents and subfolders move up one level;
 * with `withContents` the whole subtree is deleted. Returns the deleted document ids.
 */
export async function deleteFolder(id: string, { withContents = false } = {}): Promise<string[]> {
  return db.transaction("rw", db.folders, db.docs, async () => {
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
    await db.folders.bulkDelete(folderIds)
    return docIds
  })
}

/**
 * Adds an imported folder tree under `parentId` (undefined = top level), all or
 * nothing. Returns the new folder ids (the imported folder first) and document ids.
 */
export async function importFolder(
  root: ImportFolder,
  parentId?: string,
): Promise<{ folderIds: string[]; docIds: string[] }> {
  const now = Date.now()
  const folders: Folder[] = []
  const docs: Doc[] = []

  const collect = (node: ImportFolder, parentId?: string) => {
    const id = nanoid(10)
    folders.push({ id, name: node.name, ...(parentId && { parentId }), createdAt: now, updatedAt: now })
    for (const { content, fileName } of node.docs) docs.push(newDoc(content, id, fileName))
    for (const child of node.folders) collect(child, id)
  }
  collect(root, parentId)

  await db.transaction("rw", db.folders, db.docs, async () => {
    await db.folders.bulkAdd(folders)
    await db.docs.bulkAdd(docs)
  })
  return { folderIds: folders.map((folder) => folder.id), docIds: docs.map((doc) => doc.id) }
}

export function getLastDocId(): string | null {
  try {
    return localStorage.getItem(LAST_DOC_KEY)
  } catch {
    return null
  }
}

export function setLastDocId(id: string) {
  try {
    localStorage.setItem(LAST_DOC_KEY, id)
    // lets the server send returning visitors from the landing page back to the editor
    document.cookie = `${RESUME_COOKIE}=1; path=/; max-age=31536000; samesite=lax`
  } catch {
    // storage unavailable (private mode); not critical
  }
}

let startDoc: Promise<string> | null = null

/** Resolves the doc to open on start: last opened, else most recent, else a new welcome doc. */
export function resolveStartDoc(): Promise<string> {
  // shared so a double-invoked effect (React strict mode) can't seed two welcome docs
  startDoc ??= findStartDoc().finally(() => {
    startDoc = null
  })
  return startDoc
}

async function findStartDoc(): Promise<string> {
  const last = getLastDocId()
  if (last && (await db.docs.get(last))) return last

  const recent = await db.docs.orderBy("updatedAt").last()
  if (recent) return recent.id

  let welcome = ""
  try {
    const res = await fetch("/welcome.md")
    if (res.ok) welcome = await res.text()
  } catch {
    // offline: start with an empty document
  }
  return createDoc(welcome)
}
