"use client"

import { markdown, markdownLanguage } from "@codemirror/lang-markdown"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { languages } from "@codemirror/language-data"
import { EditorView } from "@codemirror/view"
import { tags as t } from "@lezer/highlight"
import CodeMirror from "@uiw/react-codemirror"

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
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.className, t.typeName], color: "var(--cm-function)" },
  { tag: [t.propertyName, t.attributeName], color: "var(--cm-property)" },
  { tag: [t.tagName, t.angleBracket], color: "var(--cm-tag)" },
])

const extensions = [
  markdown({ base: markdownLanguage, codeLanguages: languages }),
  EditorView.lineWrapping,
  syntaxHighlighting(highlightStyle),
  editorTheme,
]

interface EditorPaneProps {
  initialValue: string
  onChange: (value: string) => void
  onReady: (view: EditorView) => void
}

export default function EditorPane({ initialValue, onChange, onReady }: EditorPaneProps) {
  return (
    <CodeMirror
      // uncontrolled: `value` is only the initial document; edits flow out via onChange
      value={initialValue}
      onChange={onChange}
      onCreateEditor={onReady}
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
