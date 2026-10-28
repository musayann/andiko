import type { MarkdownIt } from "markdown-it"

const MAPPED_TOKENS = new Set([
  "paragraph_open",
  "heading_open",
  "bullet_list_open",
  "ordered_list_open",
  "list_item_open",
  "blockquote_open",
  "table_open",
  "tr_open",
  "hr",
  "code_block",
  "dl_open",
  "dt_open",
  "dd_open",
  "container_info_open",
  "container_success_open",
  "container_warning_open",
  "container_danger_open",
])

/**
 * Adds `data-source-line` (1-based) to block-level elements so the preview can
 * be mapped back to editor lines for scroll sync and task-list toggling.
 * Fences, spoilers and math blocks emit the attribute from their own renderers.
 */
export function sourceMapPlugin(md: MarkdownIt) {
  md.core.ruler.push("source_line", (state) => {
    for (const token of state.tokens) {
      if (token.map && MAPPED_TOKENS.has(token.type)) {
        token.attrSet("data-source-line", String(token.map[0] + 1))
      }
    }
  })

  // Math blocks come from @vscode/markdown-it-katex, whose renderer ignores attrs.
  const renderMath = md.renderer.rules.math_block
  if (renderMath) {
    md.renderer.rules.math_block = (tokens, idx, options, env, self) => {
      const html = renderMath(tokens, idx, options, env, self)
      const map = tokens[idx].map
      return map ? html.replace(/^<p /, `<p data-source-line="${map[0] + 1}" `) : html
    }
  }
}
