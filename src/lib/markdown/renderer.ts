import markdownit, { type MarkdownIt } from "markdown-it"
import abbr from "markdown-it-abbr"
import anchor from "markdown-it-anchor"
import deflist from "markdown-it-deflist"
import { full as emoji } from "markdown-it-emoji"
import footnote from "markdown-it-footnote"
import frontMatter from "markdown-it-front-matter"
import ins from "markdown-it-ins"
import mark from "markdown-it-mark"
import sub from "markdown-it-sub"
import sup from "markdown-it-sup"
import taskLists from "markdown-it-task-lists"
import katexModule from "@vscode/markdown-it-katex"

import { containersPlugin } from "./containers"
import { fencePlugin } from "./fence"
import { parseFrontMatter } from "./front-matter"
import { slugify } from "./slugify"
import { sourceMapPlugin } from "./source-map"
import { tocPlugin } from "./toc"
import type { DocMeta, RenderEnv, RenderResult } from "./types"

type Plugin<Options> = (md: MarkdownIt, options: Options) => void

// @vscode/markdown-it-katex is CommonJS with `exports.default`; depending on
// the bundler/runtime the default import is either the plugin or the module.
// Its types (like markdown-it-anchor's) target @types/markdown-it, so both are
// re-typed against markdown-it 15's bundled types.
const katex = ((katexModule as unknown as { default?: unknown }).default ?? katexModule) as Plugin<{
  throwOnError: boolean
}>
const anchorPlugin = anchor as unknown as Plugin<anchor.AnchorOptions>

let instance: MarkdownIt | null = null
// markdown-it-front-matter reports through a callback registered once, so the
// raw YAML of the document currently being parsed is parked here.
let currentFrontMatter: string | null = null

function createMarkdown(): MarkdownIt {
  const md = markdownit({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true,
  })

  md.use(frontMatter, (raw: string) => {
    currentFrontMatter = raw
  })
    .use(fencePlugin)
    .use(katex, { throwOnError: false })
    .use(containersPlugin)
    .use(abbr)
    .use(deflist)
    .use(emoji)
    .use(footnote)
    .use(ins)
    .use(mark)
    .use(sub)
    .use(sup)
    .use(taskLists, { enabled: true })
    .use(anchorPlugin, {
      slugify,
      tabIndex: false,
      permalink: anchor.permalink.linkInsideHeader({
        class: "anchor",
        symbol: "#",
        placement: "before",
        space: false,
        ariaHidden: true,
      }),
    })
    .use(tocPlugin)
    .use(sourceMapPlugin)

  return md
}

export function getMarkdown(): MarkdownIt {
  instance ??= createMarkdown()
  return instance
}

/**
 * Renders Markdown to (unsanitized) HTML plus document metadata and headings.
 * Callers that insert the result into a page must run it through `sanitizeHtml`.
 */
export function renderMarkdown(src: string): RenderResult {
  const md = getMarkdown()
  const env: RenderEnv = { headings: [] }

  currentFrontMatter = null
  const tokens = md.parse(src, env)
  const meta: DocMeta = parseFrontMatter(currentFrontMatter)

  // `breaks` is only read at render time, so the front-matter toggle can
  // be honoured without a second parser instance.
  const html = md.renderer.render(tokens, { ...md.options, breaks: meta.breaks ?? true }, env)
  return { html, meta, headings: env.headings }
}
