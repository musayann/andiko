// What the spell checker looks at in the desktop app (see packages/editor/src/workspace/spelling.ts):
// letters in any script, with their accents, joined by inner apostrophes ("don't", "l’été").
const WORD = /\p{L}[\p{L}\p{M}]*(?:['’][\p{L}\p{M}]+)*/gu

/** The distinct words in `text`, in order of appearance; numbers and symbols are left out. */
export function spellingWords(text: string): string[] {
  return [...new Set(text.match(WORD))]
}

/** The word at `offset` in `text` (touching it counts), with where it starts and ends. */
export function spellingWordAt(text: string, offset: number) {
  for (const match of text.matchAll(WORD)) {
    const from = match.index
    const to = from + match[0].length
    if (from > offset) break
    if (offset <= to) return { word: match[0], from, to }
  }
  return null
}
