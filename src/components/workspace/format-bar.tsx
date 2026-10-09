"use client"

import type { StateCommand } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"
import {
  BoldIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  CodeIcon,
  EyeOffIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  Heading5Icon,
  Heading6Icon,
  HeadingIcon,
  HighlighterIcon,
  ImageIcon,
  InfoIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  MinusIcon,
  OctagonAlertIcon,
  PilcrowIcon,
  PlusIcon,
  SigmaIcon,
  SquareCodeIcon,
  StrikethroughIcon,
  SubscriptIcon,
  SuperscriptIcon,
  TableIcon,
  TextQuoteIcon,
  TriangleAlertIcon,
  WorkflowIcon,
} from "lucide-react"
import { Toolbar as ToolbarPrimitive } from "radix-ui"
import { useRef, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  insertCodeBlock,
  insertContainer,
  insertDivider,
  insertImage,
  insertLink,
  insertMath,
  insertMermaid,
  insertTable,
  setHeading,
  toggleBold,
  toggleCode,
  toggleHighlight,
  toggleItalic,
  toggleList,
  toggleQuote,
  toggleStrikethrough,
  toggleSubscript,
  toggleSuperscript,
} from "@/lib/formatting"
import { cn } from "@/lib/utils"

type Icon = typeof BoldIcon

interface Action {
  label: string
  icon: Icon
  command: StateCommand
  /** shortcut keys pressed together with Cmd (Mac) or Ctrl */
  keys?: string[]
}

// index = heading level
const HEADINGS: { label: string; icon: Icon }[] = [
  { label: "Paragraph", icon: PilcrowIcon },
  { label: "Heading 1", icon: Heading1Icon },
  { label: "Heading 2", icon: Heading2Icon },
  { label: "Heading 3", icon: Heading3Icon },
  { label: "Heading 4", icon: Heading4Icon },
  { label: "Heading 5", icon: Heading5Icon },
  { label: "Heading 6", icon: Heading6Icon },
]

const INLINE: Action[] = [
  { label: "Bold", icon: BoldIcon, command: toggleBold, keys: ["B"] },
  { label: "Italic", icon: ItalicIcon, command: toggleItalic, keys: ["I"] },
  { label: "Strikethrough", icon: StrikethroughIcon, command: toggleStrikethrough, keys: ["Shift", "X"] },
  { label: "Highlight", icon: HighlighterIcon, command: toggleHighlight },
  { label: "Inline code", icon: CodeIcon, command: toggleCode, keys: ["E"] },
  { label: "Subscript", icon: SubscriptIcon, command: toggleSubscript },
  { label: "Superscript", icon: SuperscriptIcon, command: toggleSuperscript },
]

const LINES: Action[] = [
  { label: "Quote", icon: TextQuoteIcon, command: toggleQuote },
  { label: "Bulleted list", icon: ListIcon, command: toggleList("bullet") },
  { label: "Numbered list", icon: ListOrderedIcon, command: toggleList("ordered") },
  { label: "Task list", icon: ListTodoIcon, command: toggleList("task") },
]

const LINKS: Action[] = [
  { label: "Link", icon: LinkIcon, command: insertLink, keys: ["K"] },
  { label: "Image", icon: ImageIcon, command: insertImage },
]

const BLOCKS: Action[] = [
  { label: "Code block", icon: SquareCodeIcon, command: insertCodeBlock },
  { label: "Divider", icon: MinusIcon, command: insertDivider },
]

const CONTAINERS: Action[] = [
  { label: "Info box", icon: InfoIcon, command: insertContainer("info") },
  { label: "Success box", icon: CircleCheckIcon, command: insertContainer("success") },
  { label: "Warning box", icon: TriangleAlertIcon, command: insertContainer("warning") },
  { label: "Danger box", icon: OctagonAlertIcon, command: insertContainer("danger") },
  { label: "Spoiler", icon: EyeOffIcon, command: insertContainer("spoiler") },
]

const EXTRAS: Action[] = [
  { label: "Math block", icon: SigmaIcon, command: insertMath },
  { label: "Mermaid diagram", icon: WorkflowIcon, command: insertMermaid },
]

// total rows in the picker include the header row
const TABLE_COLS = 8
const TABLE_ROWS = 6
const ARROWS: Record<string, [row: number, col: number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
}

// the bar sits on the always-dark editor, so it uses the editor palette
const BUTTON_CLASS =
  "text-(--cm-muted) hover:bg-(--cm-active-line) hover:text-(--cm-fg) aria-expanded:bg-(--cm-active-line) aria-expanded:text-(--cm-fg) dark:hover:bg-(--cm-active-line)"

function formatKeys(keys: string[]) {
  return /Mac|iPhone|iPad/.test(navigator.platform)
    ? ["⌘", ...keys.map((key) => (key === "Shift" ? "⇧" : key))].join("")
    : ["Ctrl", ...keys].join("+")
}

interface BarButtonProps extends ComponentProps<typeof Button> {
  label: string
  keys?: string[]
  /** opens the surrounding DropdownMenu */
  menu?: boolean
}

function BarButton({ label, keys, menu, size = "icon-sm", className, ...props }: BarButtonProps) {
  let button = (
    <ToolbarPrimitive.Button asChild>
      <Button
        variant="ghost"
        size={size}
        aria-label={label}
        // a notch smaller than icon-sm so a 50/50 split on a laptop fits the bar on one row
        className={cn(BUTTON_CLASS, size === "icon-sm" ? "size-6.5" : "h-6.5", className)}
        {...props}
      />
    </ToolbarPrimitive.Button>
  )
  if (menu) button = <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>
        {label}
        {keys && <span className="text-muted-foreground">{formatKeys(keys)}</span>}
      </TooltipContent>
    </Tooltip>
  )
}

function TablePicker({ onPick }: { onPick: (rows: number, cols: number) => void }) {
  const [size, setSize] = useState<{ rows: number; cols: number } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // the menu only moves up and down; cells also move sideways
  const onKeyDown = (event: KeyboardEvent, row: number, col: number) => {
    const delta = ARROWS[event.key]
    if (!delta) return
    // also stops the menu's own arrow handling
    event.preventDefault()
    const nextRow = Math.min(Math.max(row + delta[0], 1), TABLE_ROWS)
    const nextCol = Math.min(Math.max(col + delta[1], 1), TABLE_COLS)
    gridRef.current?.querySelector<HTMLElement>(`[data-cell="${nextRow}-${nextCol}"]`)?.focus()
  }

  return (
    <>
      <div ref={gridRef} className="grid grid-cols-8 gap-1 p-1">
        {Array.from({ length: TABLE_ROWS * TABLE_COLS }, (_, i) => {
          const row = Math.floor(i / TABLE_COLS) + 1
          const col = (i % TABLE_COLS) + 1
          const active = size !== null && row <= size.rows && col <= size.cols
          return (
            <DropdownMenuItem
              key={i}
              data-cell={`${row}-${col}`}
              aria-label={`${col} × ${row} table`}
              onFocus={() => setSize({ rows: row, cols: col })}
              onKeyDown={(event) => onKeyDown(event, row, col)}
              onSelect={() => onPick(row, col)}
              className={cn(
                "size-4 rounded-[3px] border p-0 focus:bg-transparent",
                active ? "border-primary/50 bg-primary/15 focus:bg-primary/15" : "border-border",
              )}
            />
          )
        })}
      </div>
      <p className="px-1.5 pt-0.5 pb-1 text-center text-xs text-muted-foreground">
        {size ? `${size.cols} × ${size.rows}` : "Table size"}
      </p>
    </>
  )
}

function Group({ children }: { children: ReactNode }) {
  return <div className="flex items-center">{children}</div>
}

export function FormatBar({ view }: { view: EditorView | null }) {
  const disabled = !view

  const run = (command: StateCommand) => {
    if (!view) return
    command(view)
    view.focus()
  }

  // menus would hand focus back to their trigger; editing continues in the editor
  const refocusEditor = (event: Event) => {
    event.preventDefault()
    view?.focus()
  }

  const actionButton = ({ label, icon: Icon, command, keys }: Action) => (
    <BarButton
      key={label}
      label={label}
      keys={keys}
      disabled={disabled}
      // keep the editor focused, with its selection
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => run(command)}
    >
      <Icon />
    </BarButton>
  )

  const menuItem = ({ label, icon: Icon, command }: Action) => (
    <DropdownMenuItem key={label} onSelect={() => run(command)}>
      <Icon />
      {label}
    </DropdownMenuItem>
  )

  return (
    <ToolbarPrimitive.Root
      aria-label="Formatting"
      // groups are set apart by spacing rather than divider lines, which would dangle when the bar wraps
      className="flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 border-b border-(--cm-panel-border) bg-(--cm-panel) px-2 py-1"
    >
      <Group>
        <DropdownMenu>
          <BarButton label="Heading" menu disabled={disabled} size="sm" className="gap-0.5 px-1.5">
            <HeadingIcon />
            <ChevronDownIcon className="size-3 opacity-60" />
          </BarButton>
          <DropdownMenuContent className="w-40" onCloseAutoFocus={refocusEditor}>
            {HEADINGS.map(({ label, icon: Icon }, level) => (
              <DropdownMenuItem key={label} onSelect={() => run(setHeading(level))}>
                <Icon />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </Group>
      <Group>{INLINE.map(actionButton)}</Group>
      <Group>{LINES.map(actionButton)}</Group>
      <Group>
        {LINKS.map(actionButton)}
        <DropdownMenu>
          <BarButton label="Table" menu disabled={disabled}>
            <TableIcon />
          </BarButton>
          <DropdownMenuContent className="w-auto" onCloseAutoFocus={refocusEditor}>
            <TablePicker onPick={(rows, cols) => run(insertTable(rows - 1, cols))} />
          </DropdownMenuContent>
        </DropdownMenu>
        {BLOCKS.map(actionButton)}
      </Group>
      <Group>
        <DropdownMenu>
          <BarButton label="Insert" menu disabled={disabled} size="sm" className="gap-0.5 px-1.5">
            <PlusIcon />
            <ChevronDownIcon className="size-3 opacity-60" />
          </BarButton>
          <DropdownMenuContent className="w-48" onCloseAutoFocus={refocusEditor}>
            {CONTAINERS.map(menuItem)}
            <DropdownMenuSeparator />
            {EXTRAS.map(menuItem)}
          </DropdownMenuContent>
        </DropdownMenu>
      </Group>
    </ToolbarPrimitive.Root>
  )
}
