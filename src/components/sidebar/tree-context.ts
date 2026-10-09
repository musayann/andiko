"use client"

import { createContext, useContext, type DragEvent } from "react"

import type { Folder } from "@/lib/db"
import type { DocSummary, FolderNode, FolderTree } from "@/lib/folders"

/** A document or folder that can move between folders. `parentId` is where it is now. */
export interface TreeItem {
  kind: "doc" | "folder"
  id: string
  parentId?: string
}

/** The folder a dragged item is over; `folderId` undefined is the top level. */
export interface DropTarget {
  folderId?: string
}

export interface SidebarTree {
  activeId?: string
  tree: FolderTree<DocSummary>
  isExpanded: (folderId: string) => boolean
  setExpanded: (folderId: string, open: boolean) => void
  dragging: TreeItem | null
  setDragging: (item: TreeItem | null) => void
  hovered: DropTarget | null
  setHovered: (target: DropTarget | null) => void
  canMove: (item: TreeItem, folderId: string | undefined) => boolean
  move: (item: TreeItem, folderId: string | undefined) => void
  onNewDoc: (folderId?: string) => void
  onDuplicateDoc: (doc: DocSummary) => void
  onDownloadDoc: (doc: DocSummary) => void
  onDeleteDoc: (doc: DocSummary) => void
  /** Opens the name dialog; `moveInto` is moved into the folder once it exists. */
  onNewFolder: (parentId?: string, moveInto?: TreeItem) => void
  onRenameFolder: (folder: Folder) => void
  onExportFolder: (node: FolderNode<DocSummary>) => void
  /** Opens the import picker; files land in `folderId` (undefined = top level). */
  onImportInto: (folderId?: string) => void
  onDeleteFolder: (node: FolderNode<DocSummary>) => void
}

export const SidebarTreeContext = createContext<SidebarTree | null>(null)

export function useSidebarTree() {
  const context = useContext(SidebarTreeContext)
  if (!context) throw new Error("useSidebarTree must be used within SidebarTreeContext")
  return context
}

const DRAG_TYPE = "application/x-andiko-item"

/** Props that let a row be dragged onto folders. */
export function useDragSource(item: TreeItem) {
  const { setDragging, setHovered } = useSidebarTree()
  return {
    draggable: true,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.effectAllowed = "move"
      event.dataTransfer.setData(DRAG_TYPE, item.id)
      setDragging(item)
    },
    onDragEnd: () => {
      setDragging(null)
      setHovered(null)
    },
  }
}

/**
 * Makes an element a drop zone for `folderId` (undefined = top level). Nested
 * zones stop propagation, so the innermost folder under the pointer wins.
 */
export function useDropTarget(folderId: string | undefined) {
  const { dragging, setDragging, hovered, setHovered, canMove, move } = useSidebarTree()
  const isOver = dragging !== null && hovered !== null && hovered.folderId === folderId
  const canDrop = dragging !== null && canMove(dragging, folderId)

  const props = {
    onDragOver: (event: DragEvent) => {
      // not one of ours (e.g. a file from the desktop)
      if (!dragging) return
      event.stopPropagation()
      if (!isOver) setHovered({ folderId })
      if (canDrop) {
        event.preventDefault()
        event.dataTransfer.dropEffect = "move"
      }
    },
    onDrop: (event: DragEvent) => {
      if (!dragging) return
      event.preventDefault()
      event.stopPropagation()
      if (canDrop) move(dragging, folderId)
      setDragging(null)
      setHovered(null)
    },
  }

  return { isOver, highlight: isOver && canDrop, props }
}
