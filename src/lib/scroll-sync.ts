import type { EditorView } from "@codemirror/view"

/** A source line and the vertical offset of the element rendered from it. */
export interface LineAnchor {
  line: number
  top: number
}

/**
 * Collects `[data-source-line]` positions inside the preview, relative to the
 * scroll container's content. The result is sorted by line with monotonic
 * offsets so it can be interpolated in either direction.
 */
export function collectAnchors(scroller: HTMLElement, content: HTMLElement, lineCount: number): LineAnchor[] {
  const base = scroller.getBoundingClientRect().top - scroller.scrollTop
  const raw: LineAnchor[] = []
  for (const el of content.querySelectorAll<HTMLElement>("[data-source-line]")) {
    const line = Number(el.dataset.sourceLine)
    if (!line) continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue // hidden, e.g. inside a closed spoiler
    raw.push({ line, top: rect.top - base })
  }
  raw.sort((a, b) => a.line - b.line || a.top - b.top)

  const anchors: LineAnchor[] = [{ line: 1, top: 0 }]
  for (const anchor of raw) {
    const last = anchors[anchors.length - 1]
    if (anchor.line <= last.line || anchor.top < last.top) continue
    anchors.push(anchor)
  }
  const end = { line: lineCount + 1, top: scroller.scrollHeight }
  if (end.line > anchors[anchors.length - 1].line) anchors.push(end)
  return anchors
}

function interpolate(anchors: LineAnchor[], from: keyof LineAnchor, to: keyof LineAnchor, value: number) {
  let prev = anchors[0]
  let next: LineAnchor | undefined
  for (const anchor of anchors) {
    if (anchor[from] <= value) prev = anchor
    else {
      next = anchor
      break
    }
  }
  if (!next || next[from] === prev[from]) return prev[to]
  const ratio = (value - prev[from]) / (next[from] - prev[from])
  return prev[to] + (next[to] - prev[to]) * ratio
}

export const lineToOffset = (anchors: LineAnchor[], line: number) => interpolate(anchors, "line", "top", line)
export const offsetToLine = (anchors: LineAnchor[], top: number) => interpolate(anchors, "top", "line", top)

/** Distance between the scroll container's content top and the document top (content padding). */
function documentOffset(view: EditorView) {
  const scroller = view.scrollDOM
  return view.documentTop - scroller.getBoundingClientRect().top + scroller.scrollTop
}

/** Fractional 1-based line at the top of the editor viewport. */
export function editorTopLine(view: EditorView): number {
  const height = view.scrollDOM.scrollTop - documentOffset(view)
  const block = view.lineBlockAtHeight(Math.max(0, height))
  const line = view.state.doc.lineAt(block.from).number
  const fraction = block.height > 0 ? Math.min(1, Math.max(0, (height - block.top) / block.height)) : 0
  return line + fraction
}

export function scrollEditorToLine(view: EditorView, line: number) {
  const doc = view.state.doc
  const whole = Math.min(doc.lines, Math.max(1, Math.floor(line)))
  const block = view.lineBlockAt(doc.line(whole).from)
  const target = block.top + block.height * (line - whole)
  view.scrollDOM.scrollTop = target + documentOffset(view)
}

export function isAtBottom(el: HTMLElement) {
  return el.scrollTop + el.clientHeight >= el.scrollHeight - 2
}
