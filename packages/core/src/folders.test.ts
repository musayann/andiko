import { describe, expect, it } from "vitest"

import type { Folder } from "./db"
import { buildTree, canMoveFolder, countDocs, descendantIds, folderChain, folderPath } from "./folders"

const folder = (id: string, name: string, parentId?: string): Folder => ({
  id,
  name,
  ...(parentId && { parentId }),
  createdAt: 0,
  updatedAt: 0,
})

const doc = (id: string, folderId?: string) => ({ id, ...(folderId && { folderId }) })

// work
// ├── notes
// │   └── drafts
// └── archive
// personal
const FOLDERS = [
  folder("personal", "Personal"),
  folder("work", "Work"),
  folder("notes", "Notes", "work"),
  folder("archive", "Archive", "work"),
  folder("drafts", "Drafts", "notes"),
]

describe("buildTree", () => {
  it("keeps documents without a folder at the top level", () => {
    const tree = buildTree([], [doc("a"), doc("b")])
    expect(tree.folders).toEqual([])
    expect(tree.docs.map((d) => d.id)).toEqual(["a", "b"])
  })

  it("nests folders and documents and sorts folders by name", () => {
    const tree = buildTree(FOLDERS, [doc("a", "drafts"), doc("b", "work"), doc("c")])
    expect(tree.folders.map((n) => n.folder.id)).toEqual(["personal", "work"])
    const work = tree.folders[1]
    expect(work.children.map((n) => n.folder.id)).toEqual(["archive", "notes"])
    expect(work.docs.map((d) => d.id)).toEqual(["b"])
    expect(work.children[1].children[0].docs.map((d) => d.id)).toEqual(["a"])
    expect(tree.docs.map((d) => d.id)).toEqual(["c"])
  })

  it("keeps the incoming document order", () => {
    const tree = buildTree(FOLDERS, [doc("z", "work"), doc("a", "work")])
    expect(tree.folders[1].docs.map((d) => d.id)).toEqual(["z", "a"])
  })

  it("puts documents and folders with a missing parent at the top level", () => {
    const tree = buildTree([folder("lost", "Lost", "gone")], [doc("a", "gone")])
    expect(tree.folders.map((n) => n.folder.id)).toEqual(["lost"])
    expect(tree.docs.map((d) => d.id)).toEqual(["a"])
  })

  it("keeps folders in a parent cycle visible", () => {
    const tree = buildTree([folder("a", "A", "b"), folder("b", "B", "a"), folder("c", "C", "a")], [])
    expect(tree.folders.map((n) => n.folder.id)).toEqual(["a", "b"])
    expect(tree.folders[0].children.map((n) => n.folder.id)).toEqual(["c"])
  })
})

describe("countDocs", () => {
  it("counts documents in subfolders", () => {
    const tree = buildTree(FOLDERS, [doc("a", "work"), doc("b", "drafts"), doc("c", "archive"), doc("d")])
    expect(countDocs(tree.folders[1])).toBe(3)
    expect(countDocs(tree.folders[0])).toBe(0)
  })
})

describe("descendantIds", () => {
  it("collects subfolders at any depth", () => {
    expect([...descendantIds(FOLDERS, "work")].sort()).toEqual(["archive", "drafts", "notes"])
    expect(descendantIds(FOLDERS, "drafts").size).toBe(0)
  })

  it("terminates on a parent cycle", () => {
    expect([...descendantIds([folder("a", "A", "b"), folder("b", "B", "a")], "a")]).toEqual(["b"])
  })
})

describe("canMoveFolder", () => {
  it("allows moves to the top level and to unrelated folders", () => {
    expect(canMoveFolder(FOLDERS, "notes", undefined)).toBe(true)
    expect(canMoveFolder(FOLDERS, "notes", "personal")).toBe(true)
    expect(canMoveFolder(FOLDERS, "drafts", "archive")).toBe(true)
  })

  it("rejects moves into itself or its own subfolders", () => {
    expect(canMoveFolder(FOLDERS, "work", "work")).toBe(false)
    expect(canMoveFolder(FOLDERS, "work", "notes")).toBe(false)
    expect(canMoveFolder(FOLDERS, "work", "drafts")).toBe(false)
  })
})

describe("folderChain / folderPath", () => {
  it("lists ancestors outermost first", () => {
    expect(folderChain(FOLDERS, "drafts").map((f) => f.id)).toEqual(["work", "notes", "drafts"])
    expect(folderPath(FOLDERS, "drafts")).toBe("Work / Notes / Drafts")
  })

  it("is empty for the top level and missing folders", () => {
    expect(folderChain(FOLDERS, undefined)).toEqual([])
    expect(folderPath(FOLDERS, "gone")).toBe("")
  })

  it("terminates on a parent cycle", () => {
    expect(folderChain([folder("a", "A", "b"), folder("b", "B", "a")], "a").map((f) => f.id)).toEqual(["b", "a"])
  })
})
