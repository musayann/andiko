import type { Env } from "markdown-it"

export interface Heading {
  level: number
  text: string
  id: string
  /** 1-based source line of the heading */
  line: number
}

export interface DocMeta {
  title?: string
  description?: string
  tags: string[]
  /** The `breaks` front-matter option; defaults to true */
  breaks?: boolean
}

/** markdown-it `env` object shared by our plugins during a single render */
export interface RenderEnv extends Env {
  headings: Heading[]
  /** last line number emitted by a numbered code block, for ```lang=+ continuation */
  lastCodeLine?: number
}

export interface RenderResult {
  html: string
  meta: DocMeta
  headings: Heading[]
}
