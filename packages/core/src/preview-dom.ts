import morphdom from "morphdom"

import { getCachedMermaid, renderMermaid } from "./mermaid"
import type { ResolvedTheme } from "./theme"

const COPY_LABEL = "Copy"

const mermaidSource = (block: HTMLElement) => decodeURIComponent(block.dataset.mermaid ?? "")

/**
 * Patches `root` to match `html`, keeping DOM that is expensive or stateful:
 * rendered Mermaid SVGs, open/closed spoilers and injected copy buttons.
 */
export function patchPreview(root: HTMLElement, html: string) {
  morphdom(root, `<div>${html}</div>`, {
    childrenOnly: true,
    onBeforeElUpdated(fromEl, toEl) {
      if (fromEl.classList.contains("mermaid-block") && fromEl.dataset.renderedSource !== undefined) {
        // keep showing the current diagram; `enhancePreview` swaps it once the
        // new source has rendered, which avoids flashing the raw code
        for (const attr of ["data-source-line", "data-mermaid"]) {
          const value = toEl.getAttribute(attr)
          if (value !== null) fromEl.setAttribute(attr, value)
        }
        return false
      }
      if (fromEl instanceof HTMLDetailsElement && toEl instanceof HTMLDetailsElement) {
        toEl.open = fromEl.open
      }
      return true
    },
    onBeforeNodeDiscarded(node) {
      return !(node instanceof HTMLElement && node.classList.contains("copy-button"))
    },
  })
}

function showMermaid(block: HTMLElement, source: string, theme: ResolvedTheme, svg: string) {
  block.innerHTML = svg
  block.dataset.renderedSource = source
  block.dataset.renderedTheme = theme
}

function showMermaidError(block: HTMLElement, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const pre = document.createElement("pre")
  pre.className = "mermaid-error"
  pre.textContent = message
  block.replaceChildren(pre)
  delete block.dataset.renderedSource
}

/** Renders Mermaid diagrams in `theme` and adds copy buttons after each patch. */
export function enhancePreview(root: HTMLElement, theme: ResolvedTheme) {
  for (const block of root.querySelectorAll<HTMLElement>(".mermaid-block")) {
    const source = mermaidSource(block)
    if (block.dataset.renderedSource === source && block.dataset.renderedTheme === theme) continue

    const cached = getCachedMermaid(source, theme)
    if (cached) {
      showMermaid(block, source, theme, cached)
      continue
    }
    renderMermaid(source, theme).then(
      (svg) => {
        if (block.isConnected && mermaidSource(block) === source) showMermaid(block, source, theme, svg)
      },
      (error) => {
        if (block.isConnected && mermaidSource(block) === source) showMermaidError(block, error)
      },
    )
  }

  for (const block of root.querySelectorAll<HTMLElement>(".code-block")) {
    if (block.querySelector(":scope > .copy-button")) continue
    const button = document.createElement("button")
    button.type = "button"
    button.className = "copy-button"
    button.textContent = COPY_LABEL
    block.append(button)
  }
}

/**
 * Runs `change`, which resizes `content` (e.g. its text zoom), then scrolls `scroller` so the
 * innermost block that was at its top edge is back there, the same way into it.
 */
export function keepScrollAnchor(scroller: HTMLElement, content: HTMLElement, change: () => void) {
  if (scroller.scrollTop === 0) return change()

  const top = scroller.getBoundingClientRect().top
  let anchor: HTMLElement | undefined
  let before: DOMRect | undefined
  // document order visits a block before its children, so keep narrowing into the one that crosses the top
  for (const el of content.querySelectorAll<HTMLElement>("[data-source-line]")) {
    if (anchor && !anchor.contains(el)) break
    const rect = el.getBoundingClientRect()
    if (rect.height > 0 && rect.bottom > top) {
      anchor = el
      before = rect
    }
  }
  if (!anchor || !before) return change()

  // a block cut by the top edge keeps the same share of it hidden; one just below keeps its gap
  const gap = before.top - top
  const hidden = gap < 0 ? -gap / before.height : 0
  change()
  const after = anchor.getBoundingClientRect()
  scroller.scrollTop += after.top - (gap < 0 ? top - hidden * after.height : top + gap)
}

export async function copyCodeBlock(button: HTMLElement) {
  const code = button.closest(".code-block")?.querySelector("code")
  if (!code) return
  await navigator.clipboard.writeText(code.innerText)
  button.textContent = "Copied!"
  setTimeout(() => {
    button.textContent = COPY_LABEL
  }, 1500)
}

/**
 * Builds a static copy of the document for printing / PDF: Mermaid diagrams
 * rendered, spoilers expanded, no interactive chrome.
 */
export async function buildStaticHtml(html: string): Promise<string> {
  // an inert document so images don't start loading while we prepare it
  const doc = document.implementation.createHTMLDocument("")
  const root = doc.createElement("div")
  root.innerHTML = html

  await Promise.all(
    Array.from(root.querySelectorAll<HTMLElement>(".mermaid-block"), async (block) => {
      try {
        // exports are printed on white, so diagrams are always light
        block.innerHTML = await renderMermaid(mermaidSource(block), "light")
      } catch (error) {
        showMermaidError(block, error)
      }
    }),
  )
  for (const details of root.querySelectorAll("details")) details.setAttribute("open", "")
  for (const el of root.querySelectorAll(".anchor, .copy-button")) el.remove()

  return root.innerHTML
}
