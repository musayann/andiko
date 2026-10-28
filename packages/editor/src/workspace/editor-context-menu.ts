import { redoDepth, selectAll, undoDepth } from "@codemirror/commands"
import type { StateCommand } from "@codemirror/state"
import { EditorView } from "@codemirror/view"

import { insertTable, setHeading } from "@andiko/core/formatting"

import { accelerator, SEPARATOR, showContextMenu, type ContextMenuItem } from "../desktop/context-menu"
import { BLOCKS, CONTAINERS, EXTRAS, HEADINGS, INLINE, LINES, LINKS, REDO, UNDO, type Action } from "./format-actions"

const hasShortcut = (action: Action) => action.keys !== undefined

/** The format bar's actions; those with a shortcut sit at the top, the rest in submenus. */
function editorMenu(view: EditorView): ContextMenuItem[] {
  const run = (command: StateCommand) => () => {
    command(view)
    view.focus()
  }
  const item = ({ label, command, keys }: Action, enabled = true): ContextMenuItem => ({
    text: label,
    accelerator: accelerator(keys),
    enabled,
    action: run(command),
  })

  return [
    // the editor's own history: the native Undo would bypass it
    item(UNDO, undoDepth(view.state) > 0),
    item(REDO, redoDepth(view.state) > 0),
    SEPARATOR,
    { item: "Cut" },
    { item: "Copy" },
    { item: "Paste" },
    // the native Select All only reaches the lines CodeMirror has drawn
    { text: "Select all", accelerator: "CmdOrCtrl+A", action: run(selectAll) },
    SEPARATOR,
    ...[...INLINE, ...LINKS].filter(hasShortcut).map((action) => item(action)),
    {
      text: "Format",
      items: [
        ...INLINE.filter((action) => !hasShortcut(action)).map((action) => item(action)),
        SEPARATOR,
        ...LINES.map((action) => item(action)),
      ],
    },
    {
      text: "Heading",
      // index = heading level
      items: HEADINGS.map(({ label }, level) => ({ text: label, action: run(setHeading(level)) })),
    },
    {
      text: "Insert",
      items: [
        ...LINKS.filter((action) => !hasShortcut(action)).map((action) => item(action)),
        // the format bar picks a size; here it's 3 × 3, header row included
        { text: "Table", action: run(insertTable(2, 3)) },
        ...BLOCKS.map((action) => item(action)),
        SEPARATOR,
        ...CONTAINERS.map((action) => item(action)),
        SEPARATOR,
        ...EXTRAS.map((action) => item(action)),
      ],
    },
  ]
}

/** Right-clicking the editor shows its actions in a native menu (desktop app only). */
export const editorContextMenu = EditorView.domEventHandlers({
  contextmenu: (event, view) => {
    showContextMenu(event, editorMenu(view))
    if (!event.defaultPrevented) return false
    // the native Cut, Copy and Paste act on what has focus, which a click on the gutter doesn't move
    view.focus()
    return true
  },
})
