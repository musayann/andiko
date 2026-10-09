"use client"

import { CopyIcon, FileDownIcon, FileTextIcon, GlobeIcon, LinkIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import type { DocSummary } from "@/lib/folders"

import { MoveToMenu } from "./move-to-menu"
import { useDragSource, useSidebarTree } from "./tree-context"

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })

function formatUpdated(timestamp: number) {
  const seconds = Math.round((timestamp - Date.now()) / 1000)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ]
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relativeTime.format(Math.round(seconds / size), unit)
  }
  return "just now"
}

// the open document is a raised card on the grey sidebar
const DOC_BUTTON =
  "h-auto gap-2.5 rounded-lg px-2.5 py-2 data-active:bg-background data-active:shadow-xs data-active:ring-1 data-active:ring-sidebar-border data-active:hover:bg-background"

/** A document row. `path` names its folder, for search results shown outside the tree. */
export function DocItem({ doc, path }: { doc: DocSummary; path?: string }) {
  const tree = useSidebarTree()
  const drag = useDragSource({ kind: "doc", id: doc.id, parentId: doc.folderId })

  return (
    <SidebarMenuItem {...drag}>
      <SidebarMenuButton asChild isActive={doc.id === tree.activeId} className={DOC_BUTTON}>
        <Link href={`/d/${doc.id}`}>
          <FileTextIcon className="mt-0.5 self-start text-muted-foreground group-data-active/menu-button:text-foreground" />
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1.5">
              <span className="truncate">{doc.title}</span>
              {doc.shareId && (
                <GlobeIcon role="img" aria-label="Published" className="size-3 shrink-0 text-muted-foreground" />
              )}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {path && `${path} · `}
              {formatUpdated(doc.updatedAt)}
            </span>
          </span>
        </Link>
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover aria-label={`Actions for ${doc.title}`}>
            <MoreHorizontalIcon />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-44">
          <DropdownMenuItem onSelect={() => tree.onDuplicateDoc(doc)}>
            <CopyIcon />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => tree.onDownloadDoc(doc)}>
            <FileDownIcon />
            Download .md
          </DropdownMenuItem>
          {doc.shareId && (
            <DropdownMenuItem onSelect={() => tree.onCopyDocLink(doc)}>
              <LinkIcon />
              Copy public link
            </DropdownMenuItem>
          )}
          <MoveToMenu item={{ kind: "doc", id: doc.id, parentId: doc.folderId }} />
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => tree.onDeleteDoc(doc)}>
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}
