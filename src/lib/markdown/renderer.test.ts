import { describe, expect, it } from "vitest"

import { parseFenceInfo, splitHighlightedLines } from "./fence"
import { renderMarkdown } from "./renderer"
import { sanitizeHtml } from "./sanitize"

const render = (src: string) => renderMarkdown(src).html

describe("parseFenceInfo", () => {
  it.each([
    ["js", { lang: "js", numbered: false, start: 1, wrap: false }],
    ["js=", { lang: "js", numbered: true, start: 1, wrap: false }],
    ["js=101", { lang: "js", numbered: true, start: 101, wrap: false }],
    ["js=+", { lang: "js", numbered: true, start: null, wrap: false }],
    ["js!", { lang: "js", numbered: false, start: 1, wrap: true }],
    ["js=!", { lang: "js", numbered: true, start: 1, wrap: true }],
    ["c++=5", { lang: "c++", numbered: true, start: 5, wrap: false }],
    ["", { lang: "", numbered: false, start: 1, wrap: false }],
  ])("parses %j", (info, expected) => {
    expect(parseFenceInfo(info)).toEqual(expected)
  })
})

describe("splitHighlightedLines", () => {
  it("closes and reopens spans that cross line breaks", () => {
    const lines = splitHighlightedLines('a<span class="c">/* x\ny */</span>b')
    expect(lines).toEqual(['a<span class="c">/* x</span>', '<span class="c">y */</span>b'])
  })
})

describe("code blocks", () => {
  it("numbers lines and continues numbering with =+", () => {
    const html = render("```js=10\nconst a = 1\nconst b = 2\n```\n\n```js=+\nconst c = 3\n```\n")
    expect(html).toContain('data-line-number="10"')
    expect(html).toContain('data-line-number="11"')
    expect(html).toContain('data-line-number="12"')
    expect(html).toContain('class="code-block numbered"')
    expect(html).toContain("hljs-keyword")
  })

  it("renders mermaid fences as placeholders", () => {
    const html = render("```mermaid\ngraph TD\n  A-->B\n```\n")
    expect(html).toContain('class="mermaid-block"')
    expect(html).toContain(`data-mermaid="${encodeURIComponent("graph TD\n  A-->B")}"`)
  })
})

describe("containers", () => {
  it("renders alert boxes", () => {
    const html = render(":::warning\nCareful\n:::\n")
    expect(html).toContain('<div data-source-line="1" class="alert alert-warning">')
    expect(html).toContain("<p data-source-line=\"2\">Careful</p>")
  })

  it("renders spoilers with optional open state", () => {
    expect(render(":::spoiler Click *me*\nHidden\n:::\n")).toContain(
      '<details class="spoiler" data-source-line="1"><summary>Click <em>me</em></summary>',
    )
    expect(render(':::spoiler {state="open"} Shown\nText\n:::\n')).toContain(
      '<details class="spoiler" data-source-line="1" open><summary>Shown</summary>',
    )
  })
})

describe("headings and TOC", () => {
  it("assigns slug ids and renders [TOC]", () => {
    const { html, headings } = renderMarkdown("[TOC]\n\n# Hello World\n\n## Sub `code`\n\n# Hello World\n")
    expect(headings.map((h) => h.id)).toEqual(["hello-world", "sub-code", "hello-world-1"])
    expect(html).toContain('<nav class="toc" data-source-line="1"><ul><li><a href="#hello-world">Hello World</a><ul><li><a href="#sub-code">Sub code</a></li></ul></li><li><a href="#hello-world-1">')
    expect(html).toContain('id="hello-world"')
  })
})

describe("inline extensions", () => {
  it("supports extended inline syntax", () => {
    const html = render("==mark== ++ins++ H~2~O x^2^ :smile:")
    expect(html).toContain("<mark>mark</mark>")
    expect(html).toContain("<ins>ins</ins>")
    expect(html).toContain("H<sub>2</sub>O")
    expect(html).toContain("x<sup>2</sup>")
    expect(html).toContain("😄")
  })

  it("renders math with KaTeX", () => {
    expect(render("$E=mc^2$")).toContain('class="katex"')
    expect(render("$$\n\\int_0^1 x\\,dx\n$$\n")).toMatch(/<p data-source-line="1" class="katex-block">/)
  })

  it("renders task lists with source lines", () => {
    const html = render("- [ ] todo\n- [x] done\n")
    expect(html).toMatch(/<li class="task-list-item enabled" data-source-line="1">/)
    expect(html).toContain('checked=""')
  })

  it("uses line breaks by default and honours front matter", () => {
    expect(render("a\nb")).toContain("a<br>")
    const { html, meta } = renderMarkdown("---\ntitle: Doc\ntags: [a, b]\nbreaks: false\n---\na\nb")
    expect(meta).toEqual({ title: "Doc", description: undefined, tags: ["a", "b"], breaks: false })
    expect(html).not.toContain("<br>")
    expect(html).not.toContain("title: Doc")
  })
})

describe("sanitizeHtml", () => {
  it("strips scripts and event handlers but keeps heading ids", () => {
    const html = sanitizeHtml(render('# Title\n\n<img src=x onerror="alert(1)"><script>alert(1)</script>'))
    expect(html).not.toContain("<script")
    expect(html).not.toContain("onerror")
    expect(html).toContain('id="title"')
  })
})

describe("sanitizeHtml keeps renderer output intact", () => {
  it("keeps mermaid sources and source lines", () => {
    const html = sanitizeHtml(render("```mermaid\ngraph TD\n  A-->B\n```\n"))
    expect(html).toContain(`data-mermaid="${encodeURIComponent("graph TD\n  A-->B")}"`)
    expect(html).toContain('data-source-line="1"')
  })
})
