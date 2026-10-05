"use client"

import {
  ChevronRightIcon,
  FilePlusIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"
import { useEffect } from "react"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuSub } from "@/components/ui/sidebar"
import { countDocs, type DocSummary, type FolderNode } from "@/lib/folders"
import { cn } from "@/lib/utils"

import { DocItem } from "./doc-item"
import { MoveToMenu } from "./move-to-menu"
import { useDragSource, useDropTarget, useSidebarTree } from "./tree-context"

// while dragging, resting on a closed folder opens it so its subfolders become reachable
const OPEN_ON_HOVER_DELAY = 500

export function FolderItem({ node }: { node: FolderNode<DocSummary> }) {
  const { folder } = node
  const tree = useSidebarTree()
  const { isExpanded, setExpanded } = tree
  const open = isExpanded(folder.id)
  const drag = useDragSource({ kind: "folder", id: folder.id, parentId: folder.parentId })
  const drop = useDropTarget(folder.id)

  useEffect(() => {
    if (!drop.isOver || open) return
    const timer = setTimeout(() => setExpanded(folder.id, true), OPEN_ON_HOVER_DELAY)
    return () => clearTimeout(timer)
  }, [drop.isOver, open, folder.id, setExpanded])

  return (
    <Collapsible asChild open={open} onOpenChange={(next) => setExpanded(folder.id, next)}>
      {/* the whole folder (row and contents) is the drop zone, highlighted while a valid drop is over it */}
      <li
        data-sidebar="menu-item"
        className={cn("relative rounded-lg", drop.highlight && "bg-sidebar-accent ring-1 ring-sidebar-ring/40")}
        {...drop.props}
      >
        {/* own hover group, so hovering the folder's contents doesn't reveal this row's ⋯ button */}
        <div className="group/menu-item relative" {...drag}>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton className="gap-1.5 rounded-lg">
              <ChevronRightIcon className="text-muted-foreground transition-transform group-data-open/menu-button:rotate-90" />
              {open ? (
                <FolderOpenIcon className="text-muted-foreground" />
              ) : (
                <FolderIcon className="text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate">{folder.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{countDocs(node)}</span>
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuAction showOnHover aria-label={`Actions for folder ${folder.name}`}>
                <MoreHorizontalIcon />
              </SidebarMenuAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-44">
              <DropdownMenuItem onSelect={() => tree.onNewDoc(folder.id)}>
                <FilePlusIcon />
                New document
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => tree.onNewFolder(folder.id)}>
                <FolderPlusIcon />
                New folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => tree.onRenameFolder(folder)}>
                <PencilIcon />
                Rename
              </DropdownMenuItem>
              <MoveToMenu item={{ kind: "folder", id: folder.id, parentId: folder.parentId }} />
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => tree.onDeleteFolder(node)}>
                <Trash2Icon />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CollapsibleContent asChild>
          <SidebarMenuSub className="mr-0 gap-0 pr-0 pl-1.5">
            {node.children.map((child) => (
              <FolderItem key={child.folder.id} node={child} />
            ))}
            {node.docs.map((doc) => (
              <DocItem key={doc.id} doc={doc} />
            ))}
            {node.children.length === 0 && node.docs.length === 0 && (
              <li className="px-2 py-1.5 text-xs text-muted-foreground">Empty</li>
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
      </li>
    </Collapsible>
  )
}
