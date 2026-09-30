"use client"

import {
  BookOpenIcon,
  ChevronDownIcon,
  Columns2Icon,
  DownloadIcon,
  FileDownIcon,
  FileTextIcon,
  Link2Icon,
  Link2OffIcon,
  PencilIcon,
  PrinterIcon,
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

const SAVE_STATES: Record<SaveState, { label: string; dot: string }> = {
  saved: { label: "Saved", dot: "bg-success" },
  saving: { label: "Saving…", dot: "bg-warning animate-pulse" },
  unsaved: { label: "Unsaved", dot: "bg-warning" },
}

interface ToolbarProps {
  title: string
  saveState: SaveState
  mode: ViewMode
  onModeChange: (mode: ViewMode) => void
  allowSplit: boolean
  scrollSync: boolean
  onScrollSyncChange: (enabled: boolean) => void
  onExportPdf: () => void
  onPrint: () => void
  onDownloadMarkdown: () => void
}

export function Toolbar({
  title,
  saveState,
  mode,
  onModeChange,
  allowSplit,
  scrollSync,
  onScrollSyncChange,
  onExportPdf,
  onPrint,
  onDownloadMarkdown,
}: ToolbarProps) {
  const modes = allowSplit ? MODES : MODES.filter((item) => item.value !== "split")

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2 md:px-3">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <Separator orientation="vertical" className="mx-1 data-vertical:h-5 data-vertical:self-center" />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <h1 className="truncate text-sm font-medium tracking-tight">{title}</h1>
        <span
          className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex"
          aria-live="polite"
        >
          <span className={cn("size-1.5 rounded-full", SAVE_STATES[saveState].dot)} />
          {SAVE_STATES[saveState].label}
        </span>
      </div>

      {/* segmented control: the active mode is a raised white tab on a grey track. Styled via
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
                className="h-6 min-w-6 gap-1.5 rounded-md px-2 text-[0.8rem] text-muted-foreground hover:bg-transparent hover:text-foreground aria-checked:bg-background aria-checked:text-foreground aria-checked:shadow-xs aria-checked:ring-1 aria-checked:ring-foreground/5 [&_svg:not([class*='size-'])]:size-3.5"
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
              className={scrollSync ? "text-foreground" : "text-muted-foreground"}
            >
              {scrollSync ? <Link2Icon /> : <Link2OffIcon />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{scrollSync ? "Scroll sync on" : "Scroll sync off"}</TooltipContent>
        </Tooltip>
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
