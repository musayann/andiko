import {
  EditorSelection,
  Prec,
  type ChangeSpec,
  type EditorState,
  type Line,
  type SelectionRange,
  type StateCommand,
  type TransactionSpec,
} from "@codemirror/state"
import { keymap } from "@codemirror/view"

import type { ALERT_TYPES } from "./markdown/containers"

/**
 * Markdown formatting commands for the editor's formatting bar and shortcuts.
 * They are StateCommands, so they run on an EditorView or, in tests, on a bare
 * EditorState. Each one dispatches a single transaction (one undo step).
 */

type Target = Parameters<StateCommand>[0]

function apply({ state, dispatch }: Target, spec: TransactionSpec) {
  dispatch(state.update(spec, { scrollIntoView: true, userEvent: "input.format" }))
  return true
}

// ---------------------------------------------------------------------------
// Inline markers

/** Length of the run of `char` ending at `pos` (dir -1) or starting at `pos` (dir 1). */
function runLength(state: EditorState, pos: number, char: string, dir: 1 | -1): number {
  let length = 0
  for (;;) {
    const at = dir === 1 ? pos + length : pos - length - 1
    if (at < 0 || at >= state.doc.length || state.doc.sliceString(at, at + 1) !== char) return length
    length++
  }
}

function toggleInline(marker: string): StateCommand {
  const size = marker.length
  const char = marker[0]
  // `*` and `**` share a character, as do `~` (sub) and `~~` (strike). A run only
  // counts as this marker when its length matches, or is 3 for bold + italic.
  const isMarkerRun = (length: number) => length === size || (char === "*" && length === 3)

  return (target) => {
    const { state } = target
    const surrounded = (from: number, to: number) =>
      isMarkerRun(runLength(state, from, char, -1)) && isMarkerRun(runLength(state, to, char, 1))

    return apply(
      target,
      state.changeByRange((range) => {
        // `head` survives as a cursor when nothing was selected
        const keep = (offset: number) => (range.empty ? EditorSelection.cursor(range.head + offset) : null)

        let { from, to } = range
        if (range.empty) {
          if (surrounded(from, from)) {
            return {
              changes: { from: from - size, to: from + size },
              range: EditorSelection.cursor(from - size),
            }
          }
          const word = state.wordAt(from)
          if (!word) {
            return { changes: { from, insert: marker + marker }, range: EditorSelection.cursor(from + size) }
          }
          from = word.from
          to = word.to
        }

        if (surrounded(from, to)) {
          return {
            changes: [
              { from: from - size, to: from },
              { from: to, to: to + size },
            ],
            range: keep(-size) ?? EditorSelection.range(from - size, to - size),
          }
        }

        if (
          to - from >= 2 * size &&
          isMarkerRun(runLength(state, from, char, 1)) &&
          isMarkerRun(runLength(state, to, char, -1))
        ) {
          return {
            changes: [
              { from, to: from + size },
              { from: to - size, to },
            ],
            range: EditorSelection.range(from, to - 2 * size),
          }
        }

        return {
          changes: [
            { from, insert: marker },
            { from: to, insert: marker },
          ],
          range: keep(size) ?? EditorSelection.range(from + size, to + size),
        }
      }),
    )
  }
}

export const toggleBold = toggleInline("**")
export const toggleItalic = toggleInline("*")
export const toggleStrikethrough = toggleInline("~~")
export const toggleCode = toggleInline("`")
export const toggleHighlight = toggleInline("==")
export const toggleSubscript = toggleInline("~")
export const toggleSuperscript = toggleInline("^")

// ---------------------------------------------------------------------------
// Line prefixes

/** Lines touched by the selection, without a final line the selection only reaches the start of. */
function selectedLines(state: EditorState): Line[] {
  const lines = new Map<number, Line>()
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number
    let last = state.doc.lineAt(range.to).number
    if (last > first && state.doc.line(last).from === range.to) last--
    for (let n = first; n <= last; n++) lines.set(n, state.doc.line(n))
  }
  return [...lines.values()].sort((a, b) => a.number - b.number)
}

const isBlank = (line: Line) => line.text.trim() === ""

/** Applies per-line changes and moves cursors at a line start past the inserted prefix. */
function changeLines(target: Target, changes: ChangeSpec[]) {
  const { state } = target
  const changeSet = state.changes(changes)
  const selection = EditorSelection.create(
    state.selection.ranges.map((range: SelectionRange) =>
      EditorSelection.range(changeSet.mapPos(range.anchor, 1), changeSet.mapPos(range.head, 1)),
    ),
    state.selection.mainIndex,
  )
  return apply(target, { changes: changeSet, selection })
}

const HEADING = /^#{1,6}(?:[ \t]+|$)/

/** Turns the selected lines into headings of `level`, or paragraphs for 0 or a repeated level. */
export function setHeading(level: number): StateCommand {
  return (target) => {
    const lines = selectedLines(target.state).filter((line) => !isBlank(line))
    const prefix = (line: Line) => HEADING.exec(line.text)?.[0] ?? ""
    const off = level === 0 || lines.every((line) => prefix(line).trimEnd() === "#".repeat(level))
    const insert = off ? "" : "#".repeat(level) + " "
    return changeLines(
      target,
      lines.map((line) => ({ from: line.from, to: line.from + prefix(line).length, insert })),
    )
  }
}

const QUOTE = /^([ \t]*)> ?/

export const toggleQuote: StateCommand = (target) => {
  const lines = selectedLines(target.state)
  const quoted = lines.filter((line) => !isBlank(line))
  if (quoted.length > 0 && quoted.every((line) => QUOTE.test(line.text))) {
    return changeLines(
      target,
      quoted.map((line) => {
        const [match, indent] = QUOTE.exec(line.text)!
        return { from: line.from + indent.length, to: line.from + match.length }
      }),
    )
  }
  // blank lines get a bare `>` so the quote stays one block
  return changeLines(
    target,
    lines.map((line) => ({ from: line.from, insert: isBlank(line) && lines.length > 1 ? ">" : "> " })),
  )
}

export type ListKind = "bullet" | "ordered" | "task"

// indentation (and quote markers), then a bullet, task or number marker
const LIST_ITEM = /^([\s>]*)(?:([-*+])[ \t]+(\[[ xX]\][ \t]+)?|\d+[.)][ \t]+)?/

export function toggleList(kind: ListKind): StateCommand {
  return (target) => {
    const lines = selectedLines(target.state).filter((line) => !isBlank(line))
    const items = lines.map((line) => {
      const match = LIST_ITEM.exec(line.text)!
      const marker = match[0].slice(match[1].length)
      const current: ListKind | null = !marker ? null : match[3] ? "task" : match[2] ? "bullet" : "ordered"
      return { line, indent: match[1], marker, current }
    })

    if (items.every((item) => item.current === kind)) {
      return changeLines(
        target,
        items.map(({ line, indent, marker }) => ({
          from: line.from + indent.length,
          to: line.from + indent.length + marker.length,
        })),
      )
    }

    // numbering restarts for each nesting level
    const counters = new Map<number, number>()
    return changeLines(
      target,
      items.map(({ line, indent, marker }) => {
        for (const depth of counters.keys()) if (depth > indent.length) counters.delete(depth)
        const n = (counters.get(indent.length) ?? 0) + 1
        counters.set(indent.length, n)
        const insert = kind === "bullet" ? "- " : kind === "task" ? "- [ ] " : `${n}. `
        const from = line.from + indent.length
        return { from, to: from + marker.length, insert }
      }),
    )
  }
}

// ---------------------------------------------------------------------------
// Blocks

/**
 * Puts `body` in place of from..to as its own block, separated from the
 * surrounding text by blank lines. `select` is relative to the start of `body`.
 */
function block(state: EditorState, from: number, to: number, body: string, select: [number, number]) {
  const { doc } = state
  const first = doc.lineAt(from)
  const last = doc.lineAt(to)
  const nonBlank = (n: number) => n >= 1 && n <= doc.lines && doc.line(n).text.trim() !== ""

  const before = from > first.from ? "\n\n" : nonBlank(first.number - 1) ? "\n" : ""
  const after = to < last.to ? "\n\n" : nonBlank(last.number + 1) ? "\n" : ""
  const start = from + before.length
  return {
    changes: { from, to, insert: before + body + after },
    range: EditorSelection.range(start + select[0], start + select[1]),
  }
}

/** Wraps the selection (or a placeholder) between an opening and a closing line. */
function wrapBlock(open: string, close: string, placeholder: string): StateCommand {
  return (target) => {
    const { state } = target
    return apply(
      target,
      state.changeByRange(({ from, to }) => {
        // a selection of whole lines ends at the next line's start; leave that line break out
        if (to > from && state.doc.lineAt(to).from === to) to--
        const content = state.sliceDoc(from, to) || placeholder
        const start = open.length + 1
        return block(state, from, to, `${open}\n${content}\n${close}`, [start, start + content.length])
      }),
    )
  }
}

/** Inserts a fixed block after the selection, without replacing it. */
function insertAfter(body: string, select: [number, number]): StateCommand {
  return (target) => {
    const { state } = target
    return apply(
      target,
      state.changeByRange((range) => block(state, range.to, range.to, body, select)),
    )
  }
}

export const insertCodeBlock = wrapBlock("```", "```", "")
export const insertMath = wrapBlock("$$", "$$", "E = mc^2")
export const insertMermaid = wrapBlock("```mermaid", "```", "graph LR\n  A --> B")
export const insertDivider = insertAfter("---", [3, 3])

export type ContainerKind = (typeof ALERT_TYPES)[number] | "spoiler"

export function insertContainer(kind: ContainerKind): StateCommand {
  return kind === "spoiler" ? wrapBlock(":::spoiler Title", ":::", "Hidden content") : wrapBlock(`:::${kind}`, ":::", "Text")
}

export function tableMarkdown(rows: number, cols: number): string {
  const headers = Array.from({ length: cols }, (_, i) => `Column ${i + 1}`)
  const row = (cells: string[]) => `| ${cells.join(" | ")} |`
  return [
    row(headers),
    row(headers.map((h) => "-".repeat(h.length))),
    ...Array.from({ length: rows }, () => row(headers.map((h) => " ".repeat(h.length)))),
  ].join("\n")
}

/** A table with a header row and `rows` empty body rows; "Column 1" is selected. */
export function insertTable(rows: number, cols: number): StateCommand {
  return insertAfter(tableMarkdown(rows, cols), [2, 2 + "Column 1".length])
}

// ---------------------------------------------------------------------------
// Links

const URL_TEXT = /^(?:https?:\/\/|mailto:)\S+$/

function insertLinkLike(prefix: string, placeholder: string): StateCommand {
  return (target) => {
    const { state } = target
    return apply(
      target,
      state.changeByRange((range) => {
        const text = state.sliceDoc(range.from, range.to)
        let label = text || placeholder
        let url = "url"
        if (URL_TEXT.test(text)) [label, url] = [placeholder, text]
        const insert = `${prefix}[${label}](${url})`
        // select what still needs typing: the URL when the label is real text
        const labelFrom = range.from + prefix.length + 1
        const urlFrom = labelFrom + label.length + 2
        const selectUrl = text !== "" && label === text
        return {
          changes: { from: range.from, to: range.to, insert },
          range: selectUrl
            ? EditorSelection.range(urlFrom, urlFrom + url.length)
            : EditorSelection.range(labelFrom, labelFrom + label.length),
        }
      }),
    )
  }
}

export const insertLink = insertLinkLike("", "text")
export const insertImage = insertLinkLike("!", "alt")

// ---------------------------------------------------------------------------

const shortcuts: [string, StateCommand][] = [
  ["Mod-b", toggleBold],
  ["Mod-i", toggleItalic],
  ["Mod-Shift-x", toggleStrikethrough],
  ["Mod-e", toggleCode],
  ["Mod-k", insertLink],
]

/**
 * Higher precedence than the default keymap, which binds Mod-i to
 * selectParentSyntax. Handled keys stop propagating so window shortcuts (the
 * sidebar toggles on Mod-b) don't fire as well.
 */
export const formatKeymap = Prec.high(
  keymap.of(shortcuts.map(([key, run]) => ({ key, run, preventDefault: true, stopPropagation: true }))),
)
