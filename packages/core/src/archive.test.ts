// @vitest-environment node
// fflate checks `instanceof Uint8Array`, which fails across jsdom's realm
import { strToU8, unzipSync, zipSync } from "fflate"
import { describe, expect, it } from "vitest"

import { parseArchive, safeName, stripExtension, zipTree, type ArchiveDoc } from "./archive"
import type { Folder } from "./db"
import { buildTree } from "./folders"

const TIME = Date.UTC(2026, 0, 15)

const folder = (id: string, name: string, parentId?: string): Folder => ({
  id,
  name,
  ...(parentId && { parentId }),
  createdAt: TIME,
  updatedAt: TIME,
})

const doc = (content: string, folderId?: string, fileName?: string): ArchiveDoc => ({
  title: /^# (.+)$/m.exec(content)?.[1] ?? fileName ?? "Untitled",
  content,
  updatedAt: TIME,
  ...(folderId && { folderId }),
  ...(fileName && { fileName }),
})

const names = (zip: Uint8Array) => Object.keys(unzipSync(zip)).sort()

const zip = (files: Record<string, string>) =>
  zipSync(Object.fromEntries(Object.entries(files).map(([path, text]) => [path, strToU8(text)])))

describe("stripExtension", () => {
  it("drops only the last extension", () => {
    expect(stripExtension("Notes.md")).toBe("Notes")
    expect(stripExtension("v1.2 plan.markdown")).toBe("v1.2 plan")
    expect(stripExtension("README")).toBe("README")
  })
})

describe("safeName", () => {
  it("keeps case, spaces and non-ASCII letters but replaces reserved characters", () => {
    expect(safeName("Café Notes", "x")).toBe("Café Notes")
    expect(safeName("a/b: c?", "x")).toBe("a-b- c-")
    expect(safeName("  trailing.. ", "x")).toBe("trailing")
    expect(safeName("...", "x")).toBe("x")
  })
})

describe("zipTree", () => {
  it("writes folders as directories and documents as .md files", () => {
    const folders = [folder("work", "Work"), folder("notes", "Notes", "work"), folder("empty", "Empty", "work")]
    const tree = buildTree(folders, [doc("# Plan", "notes"), doc("# Top")])
    expect(names(zipTree(tree))).toEqual(["Work/", "Work/Empty/", "Work/Notes/", "Work/Notes/plan.md", "top.md"])
  })

  it("prefers the imported file name over the title", () => {
    const tree = buildTree([], [doc("# Something else", undefined, "Meeting Notes")])
    expect(names(zipTree(tree))).toEqual(["Meeting Notes.md"])
  })

  it("numbers colliding names, ignoring letter case", () => {
    const tree = buildTree(
      [folder("a", "Docs"), folder("b", "docs")],
      [doc("no title"), doc("still none"), doc("# Untitled"), doc("x", undefined, "UNTITLED")],
    )
    expect(names(zipTree(tree))).toEqual([
      "UNTITLED-4.md",
      "Docs/",
      "docs-2/",
      "untitled-2.md",
      "untitled-3.md",
      "untitled.md",
    ].sort())
  })

  it("stores document content as UTF-8", () => {
    const files = unzipSync(zipTree(buildTree([], [doc("# Ünïcode ✓\n\nbody")])))
    expect(new TextDecoder().decode(files["unicode.md"])).toBe("# Ünïcode ✓\n\nbody")
  })
})

describe("parseArchive", () => {
  it("round-trips a folder exported by zipTree", () => {
    const folders = [folder("work", "Work"), folder("notes", "Notes", "work")]
    const tree = buildTree(folders, [doc("# Plan\n\ntext", "notes"), doc("# Todo", "work")])
    const root = parseArchive(zipTree(tree), "work.zip")
    expect(root).toEqual({
      name: "Work",
      folders: [{ name: "Notes", folders: [], docs: [{ fileName: "plan", content: "# Plan\n\ntext" }] }],
      docs: [{ fileName: "todo", content: "# Todo" }],
    })
  })

  it("wraps loose files and multiple top-level directories in a folder named after the zip", () => {
    const loose = parseArchive(zip({ "a.md": "A", "Sub/b.md": "B" }), "My Notes.zip")
    expect(loose.name).toBe("My Notes")
    expect(loose.docs).toEqual([{ fileName: "a", content: "A" }])
    expect(loose.folders.map((f) => f.name)).toEqual(["Sub"])

    const twoRoots = parseArchive(zip({ "One/a.md": "A", "Two/b.md": "B" }), "vault.zip")
    expect(twoRoots.name).toBe("vault")
    expect(twoRoots.folders.map((f) => f.name)).toEqual(["One", "Two"])
  })

  it("skips non-Markdown files, hidden entries and macOS metadata", () => {
    const root = parseArchive(
      zip({
        "Vault/note.md": "kept",
        "Vault/readme.txt": "kept too",
        "Vault/image.png": "",
        "Vault/assets/logo.svg": "",
        "Vault/.obsidian/workspace.md": "",
        "Vault/.DS_Store": "",
        "__MACOSX/Vault/._note.md": "",
      }),
      "vault.zip",
    )
    expect(root).toEqual({
      name: "Vault",
      folders: [],
      docs: [
        { fileName: "note", content: "kept" },
        { fileName: "readme", content: "kept too" },
      ],
    })
  })

  it("handles backslash paths and strips a byte order mark", () => {
    const root = parseArchive(zip({ "Win\\Sub\\a.md": "﻿# A" }), "win.zip")
    expect(root.name).toBe("Win")
    expect(root.folders[0]).toEqual({ name: "Sub", folders: [], docs: [{ fileName: "a", content: "# A" }] })
  })

  it("throws when there are no Markdown files", () => {
    expect(() => parseArchive(zip({ "a.png": "" }), "images.zip")).toThrow("No Markdown files found in images.zip")
  })

  it("throws for data that is not a zip", () => {
    expect(() => parseArchive(strToU8("not a zip"), "fake.zip")).toThrow()
  })
})
