import type { MarkdownIt } from "markdown-it"
import hljs from "highlight.js/lib/common"
import dockerfile from "highlight.js/lib/languages/dockerfile"

import type { RenderEnv } from "./types"

hljs.registerLanguage("dockerfile", dockerfile)

export interface FenceInfo {
  lang: string
  numbered: boolean
  /** first line number; null means "continue from previous numbered block" */
  start: number | null
  wrap: boolean
}

/**
 * Parses the fence info string:
 *   ```js        plain
 *   ```js=       numbered from 1
 *   ```js=101    numbered from 101
 *   ```js=+      continue numbering from the previous numbered block
 *   ```js!       wrap long lines (can be combined: ```js=!)
 */
export function parseFenceInfo(info: string): FenceInfo {
  const match = /^([^\s=!{]*)\s*(=\s*(\d+|\+)?)?\s*(!)?/.exec(info.trim())
  const lang = (match?.[1] ?? "").toLowerCase()
  const numbered = Boolean(match?.[2])
  const startToken = match?.[3]
  return {
    lang,
    numbered,
    start: startToken === "+" ? null : startToken ? Number(startToken) : 1,
    wrap: Boolean(match?.[4]),
  }
}

function highlight(code: string, lang: string, escapeHtml: (s: string) => string) {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
    } catch {
      // fall through to plain text
    }
  }
  return escapeHtml(code)
}

/**
 * Splits highlight.js output into lines. Spans that cross a line break are
 * closed at the end of the line and reopened on the next one, so each line
 * is a self-contained HTML fragment.
 */
export function splitHighlightedLines(html: string): string[] {
  const lines: string[] = []
  const open: string[] = []
  let current = ""
  for (const [token] of html.matchAll(/<span[^>]*>|<\/span>|\n|[^<\n]+|</g)) {
    if (token === "\n") {
      lines.push(current + "</span>".repeat(open.length))
      current = open.join("")
    } else if (token.startsWith("<span")) {
      open.push(token)
      current += token
    } else if (token === "</span>") {
      open.pop()
      current += token
    } else {
      current += token
    }
  }
  lines.push(current + "</span>".repeat(open.length))
  return lines
}

export function fencePlugin(md: MarkdownIt) {
  const escapeHtml = md.utils.escapeHtml

  md.renderer.rules.fence = (tokens, idx, _options, rawEnv) => {
    const env = (rawEnv ?? {}) as RenderEnv
    const token = tokens[idx]
    const info = parseFenceInfo(md.utils.unescapeAll(token.info))
    const lineAttr = token.map ? ` data-source-line="${token.map[0] + 1}"` : ""
    const code = token.content.replace(/\n$/, "")

    if (info.lang === "mermaid") {
      // URI-encoded: DOMPurify drops attribute values containing "-->", which
      // nearly every diagram has
      return (
        `<div class="mermaid-block"${lineAttr} data-mermaid="${escapeHtml(encodeURIComponent(code))}">` +
        `<pre class="mermaid-fallback"><code>${escapeHtml(code)}</code></pre></div>\n`
      )
    }

    const highlighted = highlight(code, info.lang, escapeHtml)
    const langClass = info.lang ? ` class="language-${escapeHtml(info.lang)}"` : ""
    const classes = ["code-block"]
    if (info.wrap) classes.push("wrap")

    let body = highlighted
    let preAttrs = ""
    if (info.numbered) {
      classes.push("numbered")
      const start = info.start ?? (env.lastCodeLine ?? 0) + 1
      const lines = splitHighlightedLines(highlighted)
      const last = start + lines.length - 1
      env.lastCodeLine = last
      preAttrs = ` style="--ln-digits: ${String(last).length}"`
      body = lines
        .map((line, i) => `<span class="code-line" data-line-number="${start + i}">${line}</span>`)
        .join("")
    }

    return (
      `<div class="${classes.join(" ")}"${lineAttr}${info.lang ? ` data-lang="${escapeHtml(info.lang)}"` : ""}>` +
      `<pre class="hljs"${preAttrs}><code${langClass}>${body}</code></pre></div>\n`
    )
  }
}
