import { nanoid } from "nanoid"

import type { ImportFolder } from "./archive"
import { IS_DESKTOP_BUILD, isTauri } from "./platform"
import { RESUME_COOKIE } from "./site"
import { indexedDbStore } from "./store/indexeddb"
import type { Doc, Folder } from "./store/model"
import { sqliteStore } from "./store/sqlite"
import { getDocTitle } from "./title"

export type { Doc, DocHistory, Folder, PublicCopy } from "./store/model"
export { needsSync } from "./store/model"

// On the web, documents stay in this browser's IndexedDB. The desktop app keeps them in a
// SQLite file in Application Support, where Time Machine backs them up. Its dev server
// opened in a plain browser has no Tauri to reach the file, so it uses IndexedDB too.
const store = IS_DESKTOP_BUILD && isTauri() ? sqliteStore : indexedDbStore

/** Gets the documents ready; the desktop app reads them in before showing anything. */
export const openStore = () => store.open()

/** Re-runs `querier` whenever the documents change; undefined until its first result. */
export const useLiveQuery = store.useLiveQuery

// the store's methods don't use `this`, so they can be handed out on their own
export const {
  getSetting,
  setSetting,
  getDoc,
  getDocs,
  listDocs,
  getDocsInFolders,
  docsToSync,
  findDocByShareId,
  getDocWithHistory,
  listFolders,
  getPublicCopy,
  deleteDoc,
  moveDoc,
  setDocShare,
  markDocSynced,
  clearDocShare,
  renameFolder,
  moveFolder,
  putPublicCopy,
  deletePublicCopy,
} = store

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
  const doc = newDoc(content, folderId, fileName)
  await store.addDoc(doc)
  return doc.id
}

// Documents opened in a new tab but not stored yet: each is added on its first
// save, so a tab closed untouched leaves nothing behind. In memory only, so the
// tab of an untouched draft is dropped on restart (its document is missing).
const drafts = new Set<string>()

/** Reserves the id of a new, empty document that is only stored once it is edited. */
export function createDraft(): string {
  const id = nanoid(10)
  drafts.add(id)
  return id
}

export const isDraft = (id: string) => drafts.has(id)

/** Saves new content and, when given, the editor history that leads up to it. Stores a draft on its first save. */
export async function saveDocContent(id: string, content: string, history?: unknown) {
  await store.saveDocContent(id, content, history, drafts.has(id) ? { ...newDoc(content), id } : undefined)
  drafts.delete(id)
}

export async function duplicateDoc(id: string): Promise<string | undefined> {
  const doc = await getDoc(id)
  return doc ? createDoc(doc.content, doc.folderId, doc.fileName) : undefined
}

export async function createFolder(name: string, parentId?: string): Promise<string> {
  const now = Date.now()
  const id = nanoid(10)
  await store.addFolder({ id, name, ...(parentId && { parentId }), createdAt: now, updatedAt: now })
  return id
}

/**
 * Deletes a folder. By default its documents and subfolders move up one level;
 * with `withContents` the whole subtree is deleted. Returns the deleted document ids.
 */
export function deleteFolder(id: string, { withContents = false } = {}): Promise<string[]> {
  return store.deleteFolder(id, withContents)
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

  await store.addTree(folders, docs)
  return { folderIds: folders.map((folder) => folder.id), docIds: docs.map((doc) => doc.id) }
}

export function getLastDocId(): string | null {
  try {
    return getSetting(LAST_DOC_KEY)
  } catch {
    return null
  }
}

export function setLastDocId(id: string) {
  try {
    setSetting(LAST_DOC_KEY, id)
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
  if (last && (await getDoc(last))) return last

  const recent = await store.mostRecentDoc()
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
