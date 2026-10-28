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
 *
 * Like editorLineAt, it treats the empty space below the content as virtual lines:
 * `lineCount + 1` is where the content ends and `lineCount + 2` the end of the scroll area,
 * so that space in one pane maps onto the same space in the other.
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
  const lastChild = content.lastElementChild
  const contentEnd = lastChild ? lastChild.getBoundingClientRect().bottom - base : 0
  for (const end of [
    { line: lineCount + 1, top: contentEnd },
    { line: lineCount + 2, top: scroller.scrollHeight },
  ]) {
    const last = anchors[anchors.length - 1]
    if (end.line > last.line) anchors.push({ line: end.line, top: Math.max(end.top, last.top) })
  }
  return anchors
}

function interpolate(anchors: LineAnchor[], from: keyof LineAnchor, to: keyof LineAnchor, value: number) {
  let lo = 0
  let hi = anchors.length - 1
  if (value <= anchors[lo][from]) return anchors[lo][to]
  if (value >= anchors[hi][from]) return anchors[hi][to]
  // anchors are sorted and monotonic in both fields; find the pair around `value`
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (anchors[mid][from] <= value) lo = mid
    else hi = mid
  }
  const prev = anchors[lo]
  const next = anchors[hi]
  if (next[from] === prev[from]) return prev[to]
  return prev[to] + ((next[to] - prev[to]) * (value - prev[from])) / (next[from] - prev[from])
}

export const lineToOffset = (anchors: LineAnchor[], line: number) => interpolate(anchors, "line", "top", line)
export const offsetToLine = (anchors: LineAnchor[], top: number) => interpolate(anchors, "top", "line", top)

/** Distance between the scroll container's content top and the document top (content padding). */
function documentOffset(view: EditorView) {
  const scroller = view.scrollDOM
  return view.documentTop - scroller.getBoundingClientRect().top + scroller.scrollTop
}

/** Offset in the editor's scroll content where the last line ends and the space below it starts. */
function editorContentEnd(view: EditorView) {
  const doc = view.state.doc
  return documentOffset(view) + view.lineBlockAt(doc.line(doc.lines).from).bottom
}

/**
 * The editor's scroll height for syncing: the content plus as much space below it as above,
 * leaving out the rest of the blank space that lets the last line scroll up, which the preview
 * has no counterpart for. Synced scrolling stops with the last line at the bottom, and
 * scrolling the editor further leaves the preview at its end.
 */
export function editorScrollHeight(view: EditorView) {
  return Math.min(view.scrollDOM.scrollHeight, editorContentEnd(view) + documentOffset(view))
}

/**
 * Fractional 1-based line at a vertical offset of the editor's scroll content. The space
 * below the last line runs from virtual line `lines + 1` to `lines + 2`, as in collectAnchors.
 */
export function editorLineAt(view: EditorView, y: number): number {
  const lines = view.state.doc.lines
  const end = editorContentEnd(view)
  if (y >= end) {
    const below = editorScrollHeight(view) - end
    return lines + 1 + (below > 0 ? Math.min(1, (y - end) / below) : 1)
  }
  const height = y - documentOffset(view)
  if (height <= 0) return 1
  const block = view.lineBlockAtHeight(height)
  const line = view.state.doc.lineAt(block.from).number
  const fraction = block.height > 0 ? Math.min(1, Math.max(0, (height - block.top) / block.height)) : 0
  return line + fraction
}

/** Vertical offset of a fractional 1-based line in the editor's scroll content; the inverse of editorLineAt. */
export function editorOffsetOf(view: EditorView, line: number): number {
  const doc = view.state.doc
  if (line <= 1) return 0
  if (line >= doc.lines + 1) {
    const end = editorContentEnd(view)
    return end + (editorScrollHeight(view) - end) * Math.min(1, line - doc.lines - 1)
  }
  const whole = Math.floor(line)
  const block = view.lineBlockAt(doc.line(whole).from)
  return documentOffset(view) + block.top + block.height * (line - whole)
}

/** A scroll container, and how its content maps to source lines. */
export interface ScrollPane {
  scrollTop: number
  clientHeight: number
  scrollHeight: number
  /** Fractional source line at a vertical offset of the content. */
  lineAt(y: number): number
  /** Vertical offset of a fractional source line in the content. */
  offsetOf(line: number): number
}

// The window the other pane's position is averaged over: its half-height as a share of the
// viewport, and how many points it samples.
const SMOOTHING = 0.25
const SAMPLES = 25

/**
 * Where `target` should scroll to show what `source` shows.
 *
 * The point kept in step slides from the top of the viewport to its bottom as `source` scrolls
 * through its content, so both panes reach their top and bottom together. (Keeping the top lines
 * in step leaves one pane short of the end, and then it has to jump.) The position is averaged
 * over a window around that point, so a block much taller in one pane than in the other, such as
 * a diagram or a table of contents, speeds the other pane up and slows it down gradually rather
 * than all at once. The window narrows to nothing at either end, so the ends still line up.
 */
export function syncedScrollTop(source: ScrollPane, target: ScrollPane): number {
  const sourceRange = source.scrollHeight - source.clientHeight
  const targetRange = target.scrollHeight - target.clientHeight
  if (sourceRange <= 0 || targetRange <= 0) return 0
  const progress = Math.min(1, Math.max(0, source.scrollTop / sourceRange))
  const focus = progress * source.scrollHeight
  const half = Math.min(source.clientHeight * SMOOTHING, focus, source.scrollHeight - focus)
  let sum = 0
  for (let i = 0; i < SAMPLES; i++) {
    sum += target.offsetOf(source.lineAt(focus - half + (2 * half * i) / (SAMPLES - 1)))
  }
  // the target's own sync point sits at the same share of its viewport, which this solves for
  return (sum / SAMPLES / target.scrollHeight) * targetRange
}
