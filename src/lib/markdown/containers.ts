import type { MarkdownIt } from "markdown-it"
import container from "markdown-it-container"

export const ALERT_TYPES = ["info", "success", "warning", "danger"] as const

/**
 * Alert boxes and spoilers:
 *
 *   :::info            → <div class="alert alert-info">
 *   :::spoiler Title   → <details><summary>Title</summary>
 *   :::spoiler {state="open"} Title
 */
export function containersPlugin(md: MarkdownIt) {
  for (const type of ALERT_TYPES) {
    md.use(container, type, {
      validate: (params: string) => params.trim().split(/\s+/, 1)[0] === type,
      render(tokens, idx, options, _env, self) {
        const token = tokens[idx]
        if (token.nesting === 1) token.attrJoin("class", `alert alert-${type}`)
        return self.renderToken(tokens, idx, options)
      },
    })
  }

  md.use(container, "spoiler", {
    validate: (params: string) => /^spoiler(\s|$)/.test(params.trim()),
    render(tokens, idx) {
      const token = tokens[idx]
      if (token.nesting !== 1) return "</details>\n"

      let rest = token.info.trim().replace(/^spoiler\s*/, "")
      let open = false
      const state = /^\{\s*state\s*=\s*"?(open|closed)"?\s*\}\s*/.exec(rest)
      if (state) {
        open = state[1] === "open"
        rest = rest.slice(state[0].length)
      }
      const line = token.map ? ` data-source-line="${token.map[0] + 1}"` : ""
      const summary = rest ? md.renderInline(rest) : "Spoiler"
      return `<details class="spoiler"${line}${open ? " open" : ""}><summary>${summary}</summary>\n`
    },
  })
}
