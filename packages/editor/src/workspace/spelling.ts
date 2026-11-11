import { syntaxTree } from "@codemirror/language"
import type { EditorState, Extension } from "@codemirror/state"
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view"

import { isTauri } from "@andiko/core/platform"
import { spellingWordAt, spellingWords } from "@andiko/core/spelling"

/** Markdown that isn't prose (code, link targets, HTML), where a spell checker would only flag noise. */
const NOT_PROSE = new Set([
  "FencedCode",
  "CodeBlock",
  "InlineCode",
  "URL",
  "Autolink",
  "LinkLabel",
  "LinkReference",
  "HTMLBlock",
  "HTMLTag",
  "CommentBlock",
  "Comment",
  "ProcessingInstructionBlock",
  "ProcessingInstruction",
  "Entity",
])

/** The parts of from…to that aren't prose, in document order. */
function notProse(state: EditorState, from: number, to: number) {
  const ranges: { from: number; to: number }[] = []
  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      if (!NOT_PROSE.has(node.name)) return
      ranges.push({ from: node.from, to: node.to })
      return false
    },
  })
  return ranges
}

type SyntaxNode = ReturnType<typeof syntaxTree>["topNode"]

/** Whether the text just after `pos` is prose. */
function isProse(state: EditorState, pos: number) {
  for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, 1); node; node = node.parent)
    if (NOT_PROSE.has(node.name)) return false
  return true
}

const noSpellcheck = Decoration.mark({ attributes: { spellcheck: "false" } })

function skippedRanges(view: EditorView): DecorationSet {
  const marks = view.visibleRanges.flatMap(({ from, to }) =>
    notProse(view.state, from, to).map((range) => noSpellcheck.range(range.from, range.to)),
  )
  return Decoration.set(marks, true)
}

/** Turns spell-checking off where the text isn't prose. */
const skipNotProse = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = skippedRanges(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || syntaxTree(update.startState) !== syntaxTree(update.state))
        this.decorations = skippedRanges(update.view)
    }
  },
  { decorations: (plugin) => plugin.decorations },
)

// The desktop app shows the system menu, with its spelling suggestions, on right-clicking a
// misspelled word. The page can't ask WebKit what it underlined, so lines are checked again
// with the same macOS spell checker (see src-tauri/src/spelling.rs). Like WebKit, it checks a
// whole line at once: the language is guessed from the words around, so a word alone can pass
// where it's flagged in a sentence.

/** Whether each word checked so far is misspelled; shared by every editor. */
const misspelled = new Map<string, boolean>()

/** A line to check, and the words in it that are prose. */
interface Paragraph {
  text: string
  words: string[]
}

async function checkParagraphs(paragraphs: Paragraph[]) {
  if (paragraphs.length === 0) return
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    const found = new Set(
      await invoke<string[]>("misspelled_words", { paragraphs: paragraphs.map(({ text }) => text) }),
    )
    for (const { words } of paragraphs) for (const word of words) misspelled.set(word, found.has(word))
  } catch {
    // unchecked words get the app's menu, as they do before the check
  }
}

/** The lines on screen with prose words not checked yet. */
function uncheckedParagraphs(view: EditorView): Paragraph[] {
  const { state } = view
  const paragraphs: Paragraph[] = []
  for (const { from, to } of view.visibleRanges) {
    const skips = notProse(state, from, to)
    for (let pos = from; pos <= to;) {
      const line = state.doc.lineAt(pos)
      pos = line.to + 1
      // code and the like blanked out, so the words around them don't join up
      let prose = line.text
      for (const skip of skips) {
        const start = Math.max(skip.from, line.from) - line.from
        const end = Math.min(skip.to, line.to) - line.from
        if (start < end) prose = prose.slice(0, start) + " ".repeat(end - start) + prose.slice(end)
      }
      const words = spellingWords(prose)
      if (words.some((word) => !misspelled.has(word))) paragraphs.push({ text: line.text, words })
    }
  }
  return paragraphs
}

const CHECK_DELAY = 400

/** Checks the words on screen once typing or scrolling pauses (desktop app only). */
const checkVisibleWords = ViewPlugin.fromClass(
  class {
    timer: ReturnType<typeof setTimeout> | undefined
    constructor(readonly view: EditorView) {
      this.schedule()
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) this.schedule()
    }
    schedule() {
      if (!isTauri()) return
      clearTimeout(this.timer)
      this.timer = setTimeout(() => void checkParagraphs(uncheckedParagraphs(this.view)), CHECK_DELAY)
    }
    destroy() {
      clearTimeout(this.timer)
    }
  },
)

/** The menu may Learn or Ignore the word: check it again once the pointer or keyboard is back. */
function recheckAfterMenu(paragraph: Paragraph) {
  const recheck = () => {
    window.removeEventListener("pointermove", recheck, true)
    window.removeEventListener("keydown", recheck, true)
    void checkParagraphs([paragraph])
  }
  window.addEventListener("pointermove", recheck, true)
  window.addEventListener("keydown", recheck, true)
}

/**
 * Whether a right-click lands on a word the spell checker flags, which then gets the system menu.
 * Always false outside the desktop app, where the browser's menu shows anyway.
 */
export function misspelledWordAt(view: EditorView, event: MouseEvent) {
  if (!isTauri()) return false
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
  if (pos === null) return false

  const line = view.state.doc.lineAt(pos)
  const found = spellingWordAt(line.text, pos - line.from)
  if (!found || misspelled.get(found.word) !== true) return false
  const from = line.from + found.from
  const to = line.from + found.to
  if (!isProse(view.state, from)) return false

  // on the word itself, not in the space past the end of its line
  const start = view.coordsAtPos(from, 1)
  const end = view.coordsAtPos(to, -1)
  if (!start || !end) return false
  if (event.clientX < start.left || event.clientX > end.right) return false
  if (event.clientY < start.top || event.clientY > end.bottom) return false

  // a selection of more than the word keeps the app's menu, to format it
  const { main } = view.state.selection
  if (!main.empty && main.from <= pos && pos <= main.to && (main.from < from || main.to > to)) return false

  recheckAfterMenu({ text: line.text, words: [found.word] })
  return true
}

/**
 * Underlines misspelled words as you type, leaving code, URLs and HTML alone. Text is never
 * corrected automatically: CodeMirror's autocorrect="off" and autocapitalize="off" stay.
 */
export const spelling: Extension = [
  EditorView.contentAttributes.of({ spellcheck: "true" }),
  skipNotProse,
  checkVisibleWords,
]
