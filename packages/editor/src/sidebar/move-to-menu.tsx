"use client"

import { ArrowUpToLineIcon, FolderIcon, FolderInputIcon, FolderPlusIcon } from "lucide-react"
import { useMemo } from "react"

import type { SubmenuOptions } from "@tauri-apps/api/menu"

import type { Folder } from "@andiko/core/db"
import { folderPath, type FolderNode } from "@andiko/core/folders"
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@andiko/ui/components/dropdown-menu"

import { SEPARATOR } from "../desktop/context-menu"
import { useSidebarTree, type SidebarTree, type TreeItem } from "./tree-context"

function flatten(nodes: FolderNode<unknown>[], depth = 0): { folder: Folder; depth: number }[] {
  return nodes.flatMap((node) => [{ folder: node.folder, depth }, ...flatten(node.children, depth + 1)])
}

/** The "Move to" submenu as a native context menu, where folders go by their path as items can't be indented. */
export function moveToSubmenu(tree: SidebarTree, item: TreeItem): SubmenuOptions {
  const folders = flatten(tree.tree.folders).map(({ folder }) => folder)
  return {
    text: "Move to",
    items: [
      { text: "Top level", enabled: tree.canMove(item, undefined), action: () => tree.move(item, undefined) },
      ...(folders.length > 0 ? [SEPARATOR] : []),
      ...folders.map((folder) => ({
        text: folderPath(folders, folder.id),
        enabled: tree.canMove(item, folder.id),
        action: () => tree.move(item, folder.id),
      })),
      SEPARATOR,
      { text: "New folder…", action: () => tree.onNewFolder(item.parentId, item) },
    ],
  }
}

/** "Move to" submenu: every folder as an indented list, with impossible targets disabled. */
export function MoveToMenu({ item }: { item: TreeItem }) {
  const tree = useSidebarTree()
  const options = useMemo(() => flatten(tree.tree.folders), [tree.tree.folders])

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <FolderInputIcon />
        Move to
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-h-80 w-52 overflow-y-auto">
        <DropdownMenuItem disabled={!tree.canMove(item, undefined)} onSelect={() => tree.move(item, undefined)}>
          <ArrowUpToLineIcon />
          Top level
        </DropdownMenuItem>
        {options.length > 0 && <DropdownMenuSeparator />}
        {options.map(({ folder, depth }) => (
          <DropdownMenuItem
            key={folder.id}
            disabled={!tree.canMove(item, folder.id)}
            onSelect={() => tree.move(item, folder.id)}
            style={{ paddingLeft: `calc(0.375rem + ${depth * 0.875}rem)` }}
          >
            <FolderIcon />
            <span className="truncate">{folder.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {/* like "New Folder with Selection": created where the item is now */}
        <DropdownMenuItem onSelect={() => tree.onNewFolder(item.parentId, item)}>
          <FolderPlusIcon />
          New folder…
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
