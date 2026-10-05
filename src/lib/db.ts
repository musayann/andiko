import Dexie, { type EntityTable } from "dexie"
import { nanoid } from "nanoid"

import { canMoveFolder, descendantIds } from "./folders"
import { getDocTitle } from "./title"

export interface Doc {
  id: string
  title: string
  content: string
  /** Absent for documents outside any folder, which includes every document created before folders existed. */
  folderId?: string
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

export { db }

const LAST_DOC_KEY = "andiko:last-doc"

export async function createDoc(content = "", folderId?: string): Promise<string> {
  const now = Date.now()
  const id = nanoid(10)
  await db.docs.add({
    id,
    title: getDocTitle(content),
    content,
    ...(folderId && { folderId }),
    createdAt: now,
    updatedAt: now,
  })
  return id
}

export async function saveDocContent(id: string, content: string) {
  await db.docs.update(id, { content, title: getDocTitle(content), updatedAt: Date.now() })
}

export async function duplicateDoc(id: string): Promise<string | undefined> {
  const doc = await db.docs.get(id)
  return doc ? createDoc(doc.content, doc.folderId) : undefined
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
