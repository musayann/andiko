import type { Mermaid } from "mermaid"

import type { ResolvedTheme } from "./theme"

let loader: Promise<Mermaid> | null = null
// mermaid.initialize() is global, so renders run one at a time
let queue: Promise<unknown> = Promise.resolve()
let counter = 0

const cache = new Map<string, string>()
const CACHE_LIMIT = 200

function loadMermaid(): Promise<Mermaid> {
  loader ??= import("mermaid").then((mod) => mod.default)
  return loader
}

const cacheKey = (source: string, theme: ResolvedTheme) => `${theme}:${source}`

export function getCachedMermaid(source: string, theme: ResolvedTheme): string | undefined {
  return cache.get(cacheKey(source, theme))
}

/** Renders a diagram to SVG markup. Rejects with mermaid's parse error message. */
export function renderMermaid(source: string, theme: ResolvedTheme): Promise<string> {
  const key = cacheKey(source, theme)
  const cached = cache.get(key)
  if (cached) return Promise.resolve(cached)

  const job = queue.then(async () => {
    const mermaid = await loadMermaid()
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === "dark" ? "dark" : "default",
      securityLevel: "strict",
      fontFamily: '"Source Sans 3 Variable", "Source Sans Pro", sans-serif',
    })
    const id = `mermaid-svg-${++counter}`
    try {
      const { svg } = await mermaid.render(id, source)
      if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!)
      cache.set(key, svg)
      return svg
    } finally {
      // mermaid leaves its scratch element behind when rendering fails
      document.getElementById(`d${id}`)?.remove()
    }
  })
  queue = job.catch(() => undefined)
  return job
}
