// markdown-it 15 ships its own types; these plugins either have none or only
// types for the older @types/markdown-it, so they are declared against v15 here.

declare module "markdown-it-abbr" {
  import type { MarkdownIt } from "markdown-it"
  export default function plugin(md: MarkdownIt): void
}

declare module "markdown-it-mark" {
  import type { MarkdownIt } from "markdown-it"
  export default function plugin(md: MarkdownIt): void
}

declare module "markdown-it-ins" {
  import type { MarkdownIt } from "markdown-it"
  export default function plugin(md: MarkdownIt): void
}

declare module "markdown-it-sub" {
  import type { MarkdownIt } from "markdown-it"
  export default function plugin(md: MarkdownIt): void
}

declare module "markdown-it-sup" {
  import type { MarkdownIt } from "markdown-it"
  export default function plugin(md: MarkdownIt): void
}

declare module "markdown-it-deflist" {
  import type { MarkdownIt } from "markdown-it"
  export default function plugin(md: MarkdownIt): void
}

declare module "markdown-it-footnote" {
  import type { MarkdownIt } from "markdown-it"
  export default function plugin(md: MarkdownIt): void
}

declare module "markdown-it-emoji" {
  import type { MarkdownIt } from "markdown-it"
  export function full(md: MarkdownIt): void
  export function light(md: MarkdownIt): void
  export function bare(md: MarkdownIt): void
}

declare module "markdown-it-task-lists" {
  import type { MarkdownIt } from "markdown-it"
  export default function plugin(
    md: MarkdownIt,
    options?: { enabled?: boolean; label?: boolean; labelAfter?: boolean },
  ): void
}

declare module "markdown-it-front-matter" {
  import type { MarkdownIt } from "markdown-it"
  export default function plugin(md: MarkdownIt, onFrontMatter: (raw: string) => void): void
}

declare module "markdown-it-container" {
  import type { MarkdownIt, RendererRule } from "markdown-it"
  export interface ContainerOptions {
    marker?: string
    validate?: (params: string, markup: string) => boolean
    render?: RendererRule
  }
  export default function plugin(md: MarkdownIt, name: string, options?: ContainerOptions): void
}
