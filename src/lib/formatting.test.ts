import { EditorSelection, EditorState, type SelectionRange, type StateCommand } from "@codemirror/state"
import { describe, expect, it } from "vitest"

import {
  insertCodeBlock,
  insertContainer,
  insertDivider,
  insertImage,
  insertLink,
  insertMath,
  insertTable,
  setHeading,
  tableMarkdown,
  toggleBold,
  toggleCode,
  toggleItalic,
  toggleList,
  toggleQuote,
  toggleStrikethrough,
  toggleSubscript,
} from "./formatting"

// Documents mark a cursor with ‸ and a selection with «…».
function stateOf(doc: string): EditorState {
  const ranges: SelectionRange[] = []
  let text = ""
  let start = 0
  for (const ch of doc) {
    if (ch === "‸") ranges.push(EditorSelection.cursor(text.length))
    else if (ch === "«") start = text.length
    else if (ch === "»") ranges.push(EditorSelection.range(start, text.length))
    else text += ch
  }
  return EditorState.create({
    doc: text,
    selection: EditorSelection.create(ranges.length ? ranges : [EditorSelection.cursor(0)]),
    extensions: EditorState.allowMultipleSelections.of(true),
  })
}

function show(state: EditorState): string {
  let text = state.doc.toString()
  const ranges = [...state.selection.ranges].sort((a, b) => b.from - a.from)
  for (const range of ranges) {
    if (range.empty) text = text.slice(0, range.from) + "‸" + text.slice(range.from)
    else text = text.slice(0, range.from) + "«" + text.slice(range.from, range.to) + "»" + text.slice(range.to)
  }
  return text
}

function run(doc: string, command: StateCommand): string {
  let state = stateOf(doc)
  command({ state, dispatch: (tr) => (state = tr.state) })
  return show(state)
}

describe("inline markers", () => {
  it("wraps the selection and keeps it selected", () => {
    expect(run("make «this» bold", toggleBold)).toBe("make **«this»** bold")
    expect(run("«x»", toggleCode)).toBe("`«x»`")
  })

  it("unwraps markers around or inside the selection", () => {
    expect(run("make **«this»** bold", toggleBold)).toBe("make «this» bold")
    expect(run("make «**this**» bold", toggleBold)).toBe("make «this» bold")
  })

  it("applies to the word under an empty cursor", () => {
    expect(run("a wo‸rd", toggleBold)).toBe("a **wo‸rd**")
    expect(run("a **wo‸rd**", toggleBold)).toBe("a wo‸rd")
  })

  it("inserts an empty pair outside words and removes it again", () => {
    expect(run("a ‸", toggleBold)).toBe("a **‸**")
    expect(run("a **‸**", toggleBold)).toBe("a ‸")
  })

  it("tells markers that share a character apart", () => {
    expect(run("**«x»**", toggleItalic)).toBe("***«x»***")
    expect(run("***«x»***", toggleItalic)).toBe("**«x»**")
    expect(run("***«x»***", toggleBold)).toBe("*«x»*")
    expect(run("~~«x»~~", toggleSubscript)).toBe("~~~«x»~~~")
    expect(run("~~«x»~~", toggleStrikethrough)).toBe("«x»")
  })

  it("handles every cursor", () => {
    expect(run("«a» and «b»", toggleBold)).toBe("**«a»** and **«b»**")
  })
})

describe("headings", () => {
  it("adds, replaces and removes the heading prefix", () => {
    expect(run("Ti‸tle", setHeading(2))).toBe("## Ti‸tle")
    expect(run("## Ti‸tle", setHeading(1))).toBe("# Ti‸tle")
    expect(run("## Ti‸tle", setHeading(2))).toBe("Ti‸tle")
    expect(run("## Ti‸tle", setHeading(0))).toBe("Ti‸tle")
  })

  it("moves a cursor at the line start past the prefix", () => {
    expect(run("‸Title", setHeading(1))).toBe("# ‸Title")
  })

  it("skips blank lines", () => {
    expect(run("«a\n\nb»", setHeading(3))).toBe("### «a\n\n### b»")
  })
})

describe("lists", () => {
  it("toggles bullets on every selected line", () => {
    expect(run("«a\nb»", toggleList("bullet"))).toBe("- «a\n- b»")
    expect(run("«- a\n- b»", toggleList("bullet"))).toBe("«a\nb»")
  })

  it("numbers ordered lists per nesting level", () => {
    expect(run("«a\n  b\n  c\nd»", toggleList("ordered"))).toBe("1. «a\n  1. b\n  2. c\n2. d»")
  })

  it("switches between list types", () => {
    expect(run("«- a\n- [ ] b»", toggleList("ordered"))).toBe("«1. a\n2. b»")
    expect(run("1. a‸", toggleList("task"))).toBe("- [ ] a‸")
  })

  it("removes task markers whatever their state", () => {
    expect(run("- [x] d‸one", toggleList("task"))).toBe("d‸one")
  })

  it("keeps quote markers in front of the list marker", () => {
    expect(run("> a‸", toggleList("bullet"))).toBe("> - a‸")
  })
})

describe("quotes", () => {
  it("quotes blank lines too so the quote stays one block", () => {
    expect(run("«a\n\nb»", toggleQuote)).toBe("> «a\n>\n> b»")
  })

  it("removes the quote prefix", () => {
    expect(run("«> a\n>\n> b»", toggleQuote)).toBe("«a\n\nb»")
  })

  it("quotes an empty line", () => {
    expect(run("‸", toggleQuote)).toBe("> ‸")
  })
})

describe("blocks", () => {
  it("separates blocks from surrounding text with blank lines", () => {
    expect(run("para‸", insertCodeBlock)).toBe("para\n\n```\n‸\n```")
    expect(run("a\n«x = 1»\nb", insertCodeBlock)).toBe("a\n\n```\n«x = 1»\n```\n\nb")
  })

  it("leaves the line break of a whole-line selection outside the block", () => {
    expect(run("«a\n»b", insertCodeBlock)).toBe("```\n«a»\n```\n\nb")
  })

  it("selects the placeholder of containers and math", () => {
    expect(run("‸", insertContainer("warning"))).toBe(":::warning\n«Text»\n:::")
    expect(run("‸", insertContainer("spoiler"))).toBe(":::spoiler Title\n«Hidden content»\n:::")
    expect(run("‸", insertMath)).toBe("$$\n«E = mc^2»\n$$")
  })

  it("inserts a divider after the selection without replacing it", () => {
    expect(run("a‸", insertDivider)).toBe("a\n\n---‸")
    expect(run("«a»", insertDivider)).toBe("a\n\n---‸")
  })

  it("builds an aligned table", () => {
    expect(tableMarkdown(2, 3)).toBe(
      [
        "| Column 1 | Column 2 | Column 3 |",
        "| -------- | -------- | -------- |",
        "|          |          |          |",
        "|          |          |          |",
      ].join("\n"),
    )
    expect(run("‸", insertTable(1, 2)).split("\n")[0]).toBe("| «Column 1» | Column 2 |")
  })
})

describe("links", () => {
  it("uses the selection as the label and selects the URL", () => {
    expect(run("«docs»", insertLink)).toBe("[docs](«url»)")
  })

  it("selects the label placeholder", () => {
    expect(run("‸", insertLink)).toBe("[«text»](url)")
    expect(run("‸", insertImage)).toBe("![«alt»](url)")
  })

  it("uses a selected URL as the target", () => {
    expect(run("«https://example.com»", insertLink)).toBe("[«text»](https://example.com)")
  })
})
