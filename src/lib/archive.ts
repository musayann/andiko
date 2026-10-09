import { strToU8, unzipSync, zipSync, type Zippable } from "fflate"

import type { Doc } from "./db"
import type { FolderNode, FolderTree } from "./folders"
import { toFileName } from "./title"

export type ArchiveDoc = Pick<Doc, "title" | "content" | "updatedAt" | "fileName" | "folderId">

/** A folder read from a zip archive, ready for `importFolder`. */
export interface ImportFolder {
  name: string
  folders: ImportFolder[]
  docs: { fileName: string; content: string }[]
}

// the same extensions the import picker accepts
const MARKDOWN = /\.(md|markdown|mdown|txt)$/i

/** "Notes.md" → "Notes"; names without an extension (or only one) stay as they are. */
export const stripExtension = (name: string) => name.replace(/\.[^.]*$/, "") || name

/** A file or folder name valid on every OS. Unlike `toFileName`, keeps case, spaces and non-ASCII letters. */
export function safeName(name: string, fallback: string): string {
  const safe = name
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "")
  return safe || fallback
}

/** `base + ext`, numbered ("notes-2.md") when `taken` already holds it in any letter case. */
function uniqueName(taken: Set<string>, base: string, ext = ""): string {
  let name = base + ext
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base}-${n}${ext}`
  taken.add(name.toLowerCase())
  return name
}

/**
 * Zips folders as directories and documents as .md files, named after the file
 * they were imported from, else their title. Names are unique within each directory.
 */
export function zipTree(tree: FolderTree<ArchiveDoc>): Uint8Array<ArrayBuffer> {
  const files: Zippable = {}

  const addLevel = (dir: string, folders: FolderNode<ArchiveDoc>[], docs: ArchiveDoc[]) => {
    const taken = new Set<string>()
    for (const node of folders) {
      const path = `${dir}${uniqueName(taken, safeName(node.folder.name, "folder"))}/`
      // explicit directory entry, so empty folders are kept
      files[path] = [new Uint8Array(0), { mtime: node.folder.updatedAt }]
      addLevel(path, node.children, node.docs)
    }
    for (const doc of docs) {
      const base = doc.fileName ? safeName(doc.fileName, "untitled") : toFileName(doc.title)
      files[dir + uniqueName(taken, base, ".md")] = [strToU8(doc.content), { mtime: doc.updatedAt }]
    }
  }

  addLevel("", tree.folders, tree.docs)
  return zipSync(files)
}

/** Path segments of a Markdown file worth importing; undefined for directories, other files and hidden or macOS metadata entries. */
function markdownPath(name: string): string[] | undefined {
  if (/[\\/]$/.test(name)) return undefined
  const path = name.split(/[\\/]/).filter((segment) => segment !== "" && segment !== "." && segment !== "..")
  const file = path[path.length - 1]
  if (!file || !MARKDOWN.test(file)) return undefined
  if (path.some((segment) => segment.startsWith(".") || segment === "__MACOSX")) return undefined
  return path
}

/**
 * Reads the Markdown files in a zip as one folder. A zip whose files all sit in
 * one top-level directory (as `zipTree` of a single folder makes) imports as that
 * directory; otherwise the files go into a folder named after the zip. Directories
 * without Markdown files are left out. Throws for an invalid zip or one without
 * Markdown files.
 */
export function parseArchive(data: Uint8Array, zipName: string): ImportFolder {
  const unzipped = unzipSync(data, { filter: (file) => markdownPath(file.name) !== undefined })
  const decoder = new TextDecoder()
  const files = Object.entries(unzipped).flatMap(([name, bytes]) => {
    const path = markdownPath(name)
    return path ? [{ path, content: decoder.decode(bytes) }] : []
  })
  if (files.length === 0) throw new Error(`No Markdown files found in ${zipName}`)

  const top = files[0].path[0]
  const unwrap = files.every(({ path }) => path.length > 1 && path[0] === top)
  const root: ImportFolder = { name: unwrap ? top : stripExtension(zipName), folders: [], docs: [] }

  for (const { path, content } of files) {
    let folder = root
    for (const name of path.slice(unwrap ? 1 : 0, -1)) {
      let child = folder.folders.find((candidate) => candidate.name === name)
      if (!child) {
        child = { name, folders: [], docs: [] }
        folder.folders.push(child)
      }
      folder = child
    }
    folder.docs.push({ fileName: stripExtension(path[path.length - 1]), content })
  }
  return root
}
