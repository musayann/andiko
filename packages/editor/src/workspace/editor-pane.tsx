"use client"

import { redo, redoDepth, undoDepth } from "@codemirror/commands"
import { markdown, markdownLanguage } from "@codemirror/lang-markdown"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { languages } from "@codemirror/language-data"
import type { EditorState } from "@codemirror/state"
import { EditorView, keymap, type ViewUpdate } from "@codemirror/view"
import { tags as t } from "@lezer/highlight"
import CodeMirror from "@uiw/react-codemirror"
import { useCallback, useMemo } from "react"

import { historyToJSON, restoreState } from "@andiko/core/editor-history"
import { formatKeymap } from "@andiko/core/formatting"

import { editorContextMenu } from "./editor-context-menu"

// The editor is always dark, even though the rest of the app is light
const editorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      fontSize: "14px",
      color: "var(--cm-fg)",
      backgroundColor: "var(--cm-bg)",
      // dark native scrollbars
      colorScheme: "dark",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": {
      fontFamily: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
      lineHeight: "1.65",
      scrollbarColor: "color-mix(in oklab, var(--cm-fg) 25%, transparent) transparent",
    },
    ".cm-content": { padding: "20px 0 50vh", caretColor: "var(--cm-cursor)" },
    ".cm-line": { padding: "0 24px 0 8px" },
    ".cm-gutters": {
      color: "var(--cm-gutter)",
      backgroundColor: "var(--cm-bg)",
      border: "none",
    },
    ".cm-lineNumbers .cm-gutterElement": { paddingLeft: "16px", minWidth: "40px" },
    ".cm-activeLine": { backgroundColor: "var(--cm-active-line)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--cm-fg)" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--cm-cursor)" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      { backgroundColor: "var(--cm-selection) !important" },
    ".cm-panels": { backgroundColor: "var(--cm-panel)", color: "var(--cm-fg)" },
    ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--cm-panel-border)" },
    ".cm-searchMatch": { backgroundColor: "var(--cm-search)", outline: "none" },
    ".cm-textfield, .cm-button": { borderRadius: "4px" },
  },
  // switches CodeMirror's built-in styles (search panel, bracket matching) to their dark variants
  { dark: true },
)

const highlightStyle = HighlightStyle.define([
  { tag: t.heading, fontWeight: "700", color: "var(--cm-heading)" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: [t.link, t.url], color: "var(--cm-link)" },
  { tag: t.monospace, color: "var(--cm-code)" },
  { tag: t.quote, color: "var(--cm-muted)", fontStyle: "italic" },
  { tag: [t.processingInstruction, t.contentSeparator, t.meta], color: "var(--cm-muted)" },
  { tag: [t.keyword, t.modifier, t.operatorKeyword], color: "var(--cm-keyword)" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "var(--cm-string)" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "var(--cm-number)" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "var(--cm-muted)", fontStyle: "italic" },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName), t.className, t.typeName],
    color: "var(--cm-function)",
  },
  { tag: [t.propertyName, t.attributeName], color: "var(--cm-property)" },
  { tag: [t.tagName, t.angleBracket], color: "var(--cm-tag)" },
])

const extensions = [
  markdown({ base: markdownLanguage, codeLanguages: languages }),
  EditorView.lineWrapping,
  syntaxHighlighting(highlightStyle),
  editorTheme,
  formatKeymap,
  // CodeMirror redoes with Ctrl+Y on Windows; this makes the Ctrl+Shift+Z shown on the redo button work there too
  keymap.of([{ key: "Mod-Shift-z", run: redo, preventDefault: true }]),
  editorContextMenu,
]

interface EditorPaneProps {
  initialValue: string
  /** Undo history saved with `initialValue`. */
  initialHistory?: unknown
  /** `history` serializes the undo history that leads up to `value`, for saving with it. */
  onChange: (value: string, history: () => unknown) => void
  onReady: (view: EditorView) => void
  /** Whether there is anything to undo or redo; reported on creation and after each edit. */
  onHistoryChange: (canUndo: boolean, canRedo: boolean) => void
}

export default function EditorPane({
  initialValue,
  initialHistory,
  onChange,
  onReady,
  onHistoryChange,
}: EditorPaneProps) {
  // only read when the editor is created
  const initialState = useMemo(
    () => (initialHistory === undefined ? undefined : restoreState(initialValue, initialHistory)),
    [initialValue, initialHistory],
  )

  const reportHistory = useCallback(
    (state: EditorState) => onHistoryChange(undoDepth(state) > 0, redoDepth(state) > 0),
    [onHistoryChange],
  )

  // stable, as CodeMirror is reconfigured whenever onChange changes. The history
  // only changes along with the document, so edits are enough to keep it current.
  const handleChange = useCallback(
    (value: string, update: ViewUpdate) => {
      onChange(value, () => historyToJSON(update.state))
      reportHistory(update.state)
    },
    [onChange, reportHistory],
  )

  return (
    <CodeMirror
      // uncontrolled: `value` is only the initial document; edits flow out via onChange
      value={initialValue}
      initialState={initialState}
      onChange={handleChange}
      onCreateEditor={(view, state) => {
        onReady(view)
        reportHistory(state)
      }}
      extensions={extensions}
      // colours come from the --cm-* CSS variables used in editorTheme
      theme="none"
      height="100%"
      className="h-full"
      autoFocus
      basicSetup={{
        foldGutter: false,
        autocompletion: false,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        bracketMatching: true,
        closeBrackets: true,
        searchKeymap: true,
        highlightSelectionMatches: false,
      }}
    />
  )
}
