import type { Doc, Folder } from "./db"

export type DocSummary = Pick<Doc, "id" | "title" | "updatedAt" | "folderId">

export interface FolderNode<D> {
  folder: Folder
  children: FolderNode<D>[]
  docs: D[]
}

export interface FolderTree<D> {
  folders: FolderNode<D>[]
  /** Documents outside any folder. */
  docs: D[]
}

const byName = (a: FolderNode<unknown>, b: FolderNode<unknown>) =>
  a.folder.name.localeCompare(b.folder.name, undefined, { numeric: true, sensitivity: "base" })

/** True when following parent links from `id` leads back to it. */
function inCycle(byId: Map<string, Folder>, id: string): boolean {
  const seen = new Set<string>()
  let parentId = byId.get(id)?.parentId
  while (parentId && byId.has(parentId) && !seen.has(parentId)) {
    if (parentId === id) return true
    seen.add(parentId)
    parentId = byId.get(parentId)?.parentId
  }
  return false
}

/**
 * Nests folders and documents. Anything whose parent folder is missing (or that
 * sits in a parent cycle) lands at the top level, so no document is ever hidden.
 * Folders sort by name, documents keep their incoming order.
 */
export function buildTree<D extends Pick<Doc, "folderId">>(folders: readonly Folder[], docs: readonly D[]): FolderTree<D> {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const nodes = new Map(folders.map((folder): [string, FolderNode<D>] => [folder.id, { folder, children: [], docs: [] }]))
  const tree: FolderTree<D> = { folders: [], docs: [] }

  for (const node of nodes.values()) {
    const { id, parentId } = node.folder
    const parent = parentId && !inCycle(byId, id) ? nodes.get(parentId) : undefined
    ;(parent ? parent.children : tree.folders).push(node)
  }
  for (const doc of docs) {
    const parent = doc.folderId ? nodes.get(doc.folderId) : undefined
    ;(parent ? parent.docs : tree.docs).push(doc)
  }

  const sort = (list: FolderNode<D>[]) => {
    list.sort(byName)
    for (const node of list) sort(node.children)
  }
  sort(tree.folders)
  return tree
}

/** Number of documents in a folder, including its subfolders. */
export function countDocs(node: FolderNode<unknown>): number {
  return node.children.reduce((sum, child) => sum + countDocs(child), node.docs.length)
}

/** Ids of every folder nested (at any depth) inside `id`. */
export function descendantIds(folders: readonly Folder[], id: string): Set<string> {
  const result = new Set<string>()
  const queue = [id]
  while (queue.length) {
    const current = queue.pop()
    for (const folder of folders) {
      if (folder.parentId === current && folder.id !== id && !result.has(folder.id)) {
        result.add(folder.id)
        queue.push(folder.id)
      }
    }
  }
  return result
}

/** Whether folder `id` may move under `parentId` (undefined = top level): never into itself or its own subfolders. */
export function canMoveFolder(folders: readonly Folder[], id: string, parentId: string | undefined): boolean {
  if (parentId === undefined) return true
  return parentId !== id && !descendantIds(folders, id).has(parentId)
}

/** The folder and its ancestors, outermost first. Empty for the top level or a missing folder. */
export function folderChain(folders: readonly Folder[], id: string | undefined): Folder[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const chain: Folder[] = []
  let folder = id ? byId.get(id) : undefined
  while (folder && !chain.includes(folder)) {
    chain.unshift(folder)
    folder = folder.parentId ? byId.get(folder.parentId) : undefined
  }
  return chain
}

/** e.g. "Work / Notes"; empty for the top level. */
export const folderPath = (folders: readonly Folder[], id: string | undefined) =>
  folderChain(folders, id)
    .map((folder) => folder.name)
    .join(" / ")

const EXPANDED_KEY = "andiko:expanded-folders"

export function loadExpanded(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? "[]")
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []
  } catch {
    return []
  }
}

export function saveExpanded(ids: Iterable<string>) {
  try {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify([...ids]))
  } catch {
    // storage unavailable; folders just start collapsed next time
  }
}
