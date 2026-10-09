"use client"

import {
  BookOpenIcon,
  ChevronDownIcon,
  Columns2Icon,
  DownloadIcon,
  FileDownIcon,
  FileTextIcon,
  GlobeIcon,
  MoveVerticalIcon,
  PencilIcon,
  PrinterIcon,
  Share2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { SaveState } from "@/hooks/use-doc"
import { cn } from "@/lib/utils"

import type { ViewMode } from "./view-mode"

const MODES: { value: ViewMode; label: string; shortcut: string; icon: typeof PencilIcon }[] = [
  { value: "edit", label: "Edit", shortcut: "Ctrl+Alt+E", icon: PencilIcon },
  { value: "split", label: "Split", shortcut: "Ctrl+Alt+B", icon: Columns2Icon },
  { value: "view", label: "View", shortcut: "Ctrl+Alt+V", icon: BookOpenIcon },
]

/**
 * Where the latest edits are: Unsaved → Saved in this browser, then, for
 * a published document, Synced once its public copy has them too.
 */
export type DocStatus = SaveState | "synced" | "not-synced"

// `color` tints the dot, or the globe for the states about the public copy
const STATUSES: Record<DocStatus, { label: string; color: string; globe?: boolean; hint?: string }> = {
  unsaved: { label: "Unsaved", color: "text-warning" },
  saved: { label: "Saved", color: "text-success" },
  synced: { label: "Synced", color: "text-success", globe: true, hint: "Saved, and the public copy is up to date" },
  "not-synced": {
    label: "Not synced",
    color: "text-destructive",
    globe: true,
    hint: "Saved in this browser, but the server couldn’t be reached. Your edits will sync once it’s back.",
  },
}

interface ToolbarProps {
  title: string
  status: DocStatus
  mode: ViewMode
  onModeChange: (mode: ViewMode) => void
  allowSplit: boolean
  scrollSync: boolean
  onScrollSyncChange: (enabled: boolean) => void
  /** Whether the document has a public link. */
  shared: boolean
  /** Opens the share dialog; absent when the server can't publish. */
  onShare?: () => void
  onExportPdf: () => void
  onPrint: () => void
  onDownloadMarkdown: () => void
}

export function Toolbar({
  title,
  status,
  mode,
  onModeChange,
  allowSplit,
  scrollSync,
  onScrollSyncChange,
  shared,
  onShare,
  onExportPdf,
  onPrint,
  onDownloadMarkdown,
}: ToolbarProps) {
  const { label, color, globe, hint } = STATUSES[status]
  const statusLabel = (
    <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex" aria-live="polite">
      {globe ? <GlobeIcon className={cn("size-3", color)} /> : <span className={cn("size-1.5 rounded-full bg-current", color)} />}
      {label}
    </span>
  )
  const modes = allowSplit ? MODES : MODES.filter((item) => item.value !== "split")

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2 md:px-3">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <Separator orientation="vertical" className="mx-1 data-vertical:h-5 data-vertical:self-center" />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <h1 className="truncate text-sm font-medium tracking-tight">{title}</h1>
        {hint ? (
          <Tooltip>
            <TooltipTrigger asChild>{statusLabel}</TooltipTrigger>
            <TooltipContent>{hint}</TooltipContent>
          </Tooltip>
        ) : (
          statusLabel
        )}
      </div>

      {/* segmented control: the active mode is a raised tab on a grey track. Styled via
          aria-checked because the tooltip trigger overwrites the item's data-state */}
      <ToggleGroup
        type="single"
        spacing={0.5}
        value={mode}
        onValueChange={(value) => value && onModeChange(value as ViewMode)}
        aria-label="View mode"
        className="rounded-lg bg-muted p-0.5"
      >
        {modes.map(({ value, label, shortcut, icon: Icon }) => (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value={value}
                aria-label={label}
                className="h-6 min-w-6 gap-1.5 rounded-md px-2 text-[0.8rem] text-muted-foreground hover:bg-transparent hover:text-foreground aria-checked:bg-background aria-checked:text-foreground aria-checked:shadow-xs aria-checked:ring-1 aria-checked:ring-foreground/5 dark:aria-checked:bg-input [&_svg:not([class*='size-'])]:size-3.5"
              >
                <Icon />
                <span className="hidden lg:inline">{label}</span>
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>
              {label} <span className="text-muted-foreground">{shortcut}</span>
            </TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>

      {mode === "split" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-pressed={scrollSync}
              aria-label="Sync scrolling"
              onClick={() => onScrollSyncChange(!scrollSync)}
              className="text-muted-foreground aria-pressed:bg-muted aria-pressed:text-foreground"
            >
              <MoveVerticalIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{scrollSync ? "Scroll sync on" : "Scroll sync off"}</TooltipContent>
        </Tooltip>
      )}

      {onShare && (
        <Button variant="outline" size="sm" onClick={onShare} aria-label={shared ? "Shared" : "Share"}>
          {shared ? <GlobeIcon className="text-primary" /> : <Share2Icon />}
          <span className="hidden sm:inline">{shared ? "Shared" : "Share"}</span>
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm">
            <DownloadIcon />
            <span className="hidden sm:inline">Export</span>
            <ChevronDownIcon className="hidden opacity-60 sm:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={onExportPdf}>
            <FileDownIcon />
            PDF…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onPrint}>
            <PrinterIcon />
            Print
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDownloadMarkdown}>
            <FileTextIcon />
            Markdown (.md)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
