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

/**
 * A document's undo/redo history. It lives in its own table, apart from
 * `docs`, so it stays on this device: publishing and exports only read docs.
 */
export interface DocHistory {
  /** The document's id. */
  id: string
  /** The editor's serialized history; opaque outside the editor. */
  history: unknown
  /** The document's `updatedAt` it was saved with; any other value means it belongs to other content. */
  updatedAt: number
}

/** A public document fetched by the desktop app, kept so it still opens offline. */
export interface PublicCopy {
  /** The public id. */
  id: string
  title: string
  content: string
  /** When the server last changed it. */
  updatedAt: string
  fetchedAt: number
}

export interface Folder {
  id: string
  name: string
  /** Absent for top-level folders. */
  parentId?: string
  createdAt: number
  updatedAt: number
}

/** True when a published document has edits its public copy doesn't have yet. */
export const needsSync = (doc: Doc) => doc.shareId !== undefined && doc.updatedAt > (doc.syncedAt ?? 0)

/**
 * Where documents are kept: IndexedDB on the web (./indexeddb.ts), a SQLite file in
 * Application Support in the desktop app (./sqlite.ts). ../db.ts builds on it.
 */
export interface Store {
  /** Loads what the store needs before the first read. */
  open(): Promise<void>
  /** Re-runs `querier` whenever the documents change; undefined until its first result. */
  useLiveQuery<T>(querier: () => Promise<T> | T, deps: unknown[]): T | undefined

  /** Small app state (owner token, open tabs) kept with the documents. Throws when storage is unavailable. */
  getSetting(key: string): string | null
  setSetting(key: string, value: string): void

  getDoc(id: string): Promise<Doc | undefined>
  getDocs(ids: string[]): Promise<(Doc | undefined)[]>
  /** Last edited first. */
  listDocs(): Promise<Doc[]>
  getDocsInFolders(folderIds: string[]): Promise<Doc[]>
  /** Published documents whose public copy is behind (see needsSync). */
  docsToSync(): Promise<Doc[]>
  findDocByShareId(shareId: string): Promise<Doc | undefined>
  /** The last edited document. */
  mostRecentDoc(): Promise<Doc | undefined>
  /** A document and its editor history, read together so they match. */
  getDocWithHistory(id: string): Promise<{ doc?: Doc; history?: DocHistory }>
  listFolders(): Promise<Folder[]>
  getPublicCopy(id: string): Promise<PublicCopy | undefined>

  addDoc(doc: Doc): Promise<void>
  /** Saves new content and, when given, its editor history. Adds `draft` (with this content) when the document isn't stored yet. */
  saveDocContent(id: string, content: string, history?: unknown, draft?: Doc): Promise<void>
  deleteDoc(id: string): Promise<void>
  /** Moves a document into a folder, or to the top level. Leaves updatedAt alone: it tracks content edits. */
  moveDoc(id: string, folderId?: string): Promise<void>
  setDocShare(id: string, shareId: string, syncedAt: number): Promise<void>
  /** Records a push of the version saved at `updatedAt`, unless the document was unpublished or republished meanwhile. */
  markDocSynced(id: string, shareId: string, updatedAt: number): Promise<void>
  clearDocShare(id: string): Promise<void>
  addFolder(folder: Folder): Promise<void>
  renameFolder(id: string, name: string): Promise<void>
  /** Moves a folder under another folder, or to the top level. Returns false for a move into itself or its own subfolders. */
  moveFolder(id: string, parentId?: string): Promise<boolean>
  /**
   * Deletes a folder. Its documents and subfolders move up one level, or with
   * `withContents` the whole subtree is deleted. Returns the deleted document ids.
   */
  deleteFolder(id: string, withContents: boolean): Promise<string[]>
  /** Adds folders and documents all or nothing. */
  addTree(folders: Folder[], docs: Doc[]): Promise<void>
  putPublicCopy(copy: PublicCopy): Promise<void>
  deletePublicCopy(id: string): Promise<void>
}
