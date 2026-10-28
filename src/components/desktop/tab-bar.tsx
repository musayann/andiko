"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { FileTextIcon, GlobeIcon, LinkIcon, PlusIcon, XIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { db } from "@/lib/db"
import { activateTab, closeTab, moveTab, tabKey, type Tab, type TabsState } from "@/lib/tabs"
import { cn } from "@/lib/utils"

/** The tab's label: a document's title, or a public document's once it has been fetched. */
function useTabTitle(tab: Tab): string | undefined {
  return useLiveQuery(async () => {
    try {
      if (tab.kind === "doc") return (await db.docs.get(tab.docId))?.title
      return (await db.publicCopies.get(tab.shareId))?.title
    } catch {
      return undefined
    }
  }, [tab.kind, tab.kind === "doc" ? tab.docId : tab.shareId])
}

interface TabItemProps {
  tab: Tab
  index: number
  active: boolean
  dragOver: boolean
  onDragStart: (index: number) => void
  onDragOver: (index: number | null) => void
  onDrop: (index: number) => void
}

function TabItem({ tab, index, active, dragOver, onDragStart, onDragOver, onDrop }: TabItemProps) {
  const key = tabKey(tab)
  const title = useTabTitle(tab) ?? (tab.kind === "doc" ? "Untitled" : "Shared document")
  const Icon = tab.kind === "doc" ? FileTextIcon : GlobeIcon

  return (
    <div
      role="tab"
      aria-selected={active}
      tabIndex={0}
      draggable
      title={title}
      onClick={() => activateTab(key)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") activateTab(key)
      }}
      // middle click closes, as in browsers
      onAuxClick={(event) => {
        if (event.button === 1) closeTab(key)
      }}
      onDragStart={() => onDragStart(index)}
      onDragOver={(event) => {
        event.preventDefault()
        onDragOver(index)
      }}
      onDragLeave={() => onDragOver(null)}
      onDrop={(event) => {
        event.preventDefault()
        onDrop(index)
      }}
      className={cn(
        "group/tab relative flex h-8 max-w-56 min-w-28 shrink-0 cursor-default items-center gap-1.5 rounded-md px-2.5 text-sm outline-none select-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-background text-foreground shadow-xs ring-1 ring-border" : "text-muted-foreground hover:bg-muted",
        dragOver && "ring-2 ring-ring",
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{title}</span>
      <button
        type="button"
        aria-label={`Close ${title}`}
        onClick={(event) => {
          event.stopPropagation()
          closeTab(key)
        }}
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-sm text-muted-foreground outline-none hover:bg-muted-foreground/20 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          !active && "opacity-0 group-hover/tab:opacity-100 focus-visible:opacity-100",
        )}
      >
        <XIcon className="size-3" />
      </button>
    </div>
  )
}

interface TabBarProps extends TabsState {
  onNew: () => void
  onOpenLink: () => void
}

export function TabBar({ tabs, active, onNew, onOpenLink }: TabBarProps) {
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const endDrag = () => {
    setDragFrom(null)
    setDragOver(null)
  }

  return (
    <div className="flex h-11 shrink-0 items-center gap-1 border-b bg-muted/40 px-2" onDragEnd={endDrag}>
      <div role="tablist" aria-label="Open documents" className="flex min-w-0 items-center gap-1 overflow-x-auto py-1">
        {tabs.map((tab, index) => (
          <TabItem
            key={tabKey(tab)}
            tab={tab}
            index={index}
            active={tabKey(tab) === active}
            dragOver={dragFrom !== null && dragFrom !== index && dragOver === index}
            onDragStart={setDragFrom}
            onDragOver={setDragOver}
            onDrop={(to) => {
              if (dragFrom !== null) moveTab(dragFrom, to)
              endDrag()
            }}
          />
        ))}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="New document" onClick={onNew}>
            <PlusIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>New document (⌘T)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Open shared link" onClick={onOpenLink}>
            <LinkIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open shared link (⌘L)</TooltipContent>
      </Tooltip>
    </div>
  )
}
