import { redo, undo } from "@codemirror/commands"
import type { StateCommand } from "@codemirror/state"
import {
  BoldIcon,
  CircleCheckIcon,
  CodeIcon,
  EyeOffIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  Heading5Icon,
  Heading6Icon,
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
  Redo2Icon,
  SigmaIcon,
  SquareCodeIcon,
  StrikethroughIcon,
  SubscriptIcon,
  SuperscriptIcon,
  TextQuoteIcon,
  TriangleAlertIcon,
  Undo2Icon,
  WorkflowIcon,
} from "lucide-react"

import {
  insertCodeBlock,
  insertContainer,
  insertDivider,
  insertImage,
  insertLink,
  insertMath,
  insertMermaid,
  toggleBold,
  toggleCode,
  toggleHighlight,
  toggleItalic,
  toggleList,
  toggleQuote,
  toggleStrikethrough,
  toggleSubscript,
  toggleSuperscript,
} from "@andiko/core/formatting"

// The editor's actions, shared by the format bar and the editor's context menu

type Icon = typeof BoldIcon

export interface Action {
  label: string
  icon: Icon
  command: StateCommand
  /** shortcut keys pressed together with Cmd (Mac) or Ctrl */
  keys?: string[]
}

export const UNDO: Action = { label: "Undo", icon: Undo2Icon, command: undo, keys: ["Z"] }
export const REDO: Action = { label: "Redo", icon: Redo2Icon, command: redo, keys: ["Shift", "Z"] }

// index = heading level
export const HEADINGS: { label: string; icon: Icon }[] = [
  { label: "Paragraph", icon: PilcrowIcon },
  { label: "Heading 1", icon: Heading1Icon },
  { label: "Heading 2", icon: Heading2Icon },
  { label: "Heading 3", icon: Heading3Icon },
  { label: "Heading 4", icon: Heading4Icon },
  { label: "Heading 5", icon: Heading5Icon },
  { label: "Heading 6", icon: Heading6Icon },
]

export const INLINE: Action[] = [
  { label: "Bold", icon: BoldIcon, command: toggleBold, keys: ["B"] },
  { label: "Italic", icon: ItalicIcon, command: toggleItalic, keys: ["I"] },
  { label: "Strikethrough", icon: StrikethroughIcon, command: toggleStrikethrough, keys: ["Shift", "X"] },
  { label: "Highlight", icon: HighlighterIcon, command: toggleHighlight },
  { label: "Inline code", icon: CodeIcon, command: toggleCode, keys: ["E"] },
  { label: "Subscript", icon: SubscriptIcon, command: toggleSubscript },
  { label: "Superscript", icon: SuperscriptIcon, command: toggleSuperscript },
]

export const LINES: Action[] = [
  { label: "Quote", icon: TextQuoteIcon, command: toggleQuote },
  { label: "Bulleted list", icon: ListIcon, command: toggleList("bullet") },
  { label: "Numbered list", icon: ListOrderedIcon, command: toggleList("ordered") },
  { label: "Task list", icon: ListTodoIcon, command: toggleList("task") },
]

export const LINKS: Action[] = [
  { label: "Link", icon: LinkIcon, command: insertLink, keys: ["K"] },
  { label: "Image", icon: ImageIcon, command: insertImage },
]

export const BLOCKS: Action[] = [
  { label: "Code block", icon: SquareCodeIcon, command: insertCodeBlock },
  { label: "Divider", icon: MinusIcon, command: insertDivider },
]

export const CONTAINERS: Action[] = [
  { label: "Info box", icon: InfoIcon, command: insertContainer("info") },
  { label: "Success box", icon: CircleCheckIcon, command: insertContainer("success") },
  { label: "Warning box", icon: TriangleAlertIcon, command: insertContainer("warning") },
  { label: "Danger box", icon: OctagonAlertIcon, command: insertContainer("danger") },
  { label: "Spoiler", icon: EyeOffIcon, command: insertContainer("spoiler") },
]

export const EXTRAS: Action[] = [
  { label: "Math block", icon: SigmaIcon, command: insertMath },
  { label: "Mermaid diagram", icon: WorkflowIcon, command: insertMermaid },
]
