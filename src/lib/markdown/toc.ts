import type { MarkdownIt, Token } from "markdown-it"

import type { Heading, RenderEnv } from "./types"

function inlineText(token: Token | undefined): string {
  return (token?.children ?? [])
    .filter((child) => child.type === "text" || child.type === "code_inline")
    .map((child) => child.content)
    .join("")
    .trim()
}

interface TocNode {
  heading?: Heading
  children: TocNode[]
}

function buildTree(headings: Heading[]): TocNode {
  const root: TocNode = { children: [] }
  const stack: { level: number; node: TocNode }[] = [{ level: 0, node: root }]
  for (const heading of headings) {
    while (stack.length > 1 && stack[stack.length - 1].level >= heading.level) stack.pop()
    const node: TocNode = { heading, children: [] }
    stack[stack.length - 1].node.children.push(node)
    stack.push({ level: heading.level, node })
  }
  return root
}

/**
 * Collects headings (after markdown-it-anchor assigned ids) into `env.headings`
 * and renders the `[TOC]` placeholder as a nested list.
 * Must be registered after markdown-it-anchor.
 */
export function tocPlugin(md: MarkdownIt) {
  const escape = md.utils.escapeHtml

  md.core.ruler.push("collect_headings", (state) => {
    const env = state.env as RenderEnv
    env.headings = []
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      if (token.type !== "heading_open") continue
      const id = token.attrGet("id")
      if (!id) continue
      env.headings.push({
        level: Number(token.tag.slice(1)),
        text: inlineText(tokens[i + 1]),
        id: String(id),
        line: (token.map?.[0] ?? 0) + 1,
      })
    }
  })

  md.block.ruler.before(
    "paragraph",
    "toc_placeholder",
    (state, startLine, _endLine, silent) => {
      const start = state.bMarks[startLine] + state.tShift[startLine]
      const line = state.src.slice(start, state.eMarks[startLine]).trim()
      if (!/^\[toc\]$/i.test(line)) return false
      if (silent) return true
      const token = state.push("toc_placeholder", "nav", 0)
      token.map = [startLine, startLine + 1]
      state.line = startLine + 1
      return true
    },
    { alt: ["paragraph"] },
  )

  const renderList = (nodes: TocNode[]): string =>
    nodes.length === 0
      ? ""
      : "<ul>" +
        nodes
          .map((node) =>
            node.heading
              ? `<li><a href="#${escape(node.heading.id)}">${escape(node.heading.text)}</a>${renderList(node.children)}</li>`
              : renderList(node.children),
          )
          .join("") +
        "</ul>"

  md.renderer.rules.toc_placeholder = (tokens, idx, _options, env) => {
    const map = tokens[idx].map
    const line = map ? ` data-source-line="${map[0] + 1}"` : ""
    const headings = (env as RenderEnv | undefined)?.headings ?? []
    return `<nav class="toc"${line}>${renderList(buildTree(headings).children)}</nav>\n`
  }
}
