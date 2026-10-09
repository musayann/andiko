"use client"

import { TagIcon } from "lucide-react"
import { useLayoutEffect, useMemo, useRef, type MouseEvent, type RefObject } from "react"
import { toast } from "sonner"

import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useTheme } from "@/hooks/use-theme"
import { renderMarkdown } from "@/lib/markdown/renderer"
import { sanitizeHtml } from "@/lib/markdown/sanitize"
import { copyCodeBlock, enhancePreview, patchPreview } from "@/lib/preview-dom"
import { cn } from "@/lib/utils"

import { DocumentToc } from "./document-toc"

interface PreviewPaneProps {
  content: string
  showToc: boolean
  scrollRef: RefObject<HTMLDivElement | null>
  /** Absent for a read-only document: task checkboxes then ignore clicks. */
  onToggleTask?: (line: number) => void
  onRendered?: () => void
}

export function PreviewPane({ content, showToc, scrollRef, onToggleTask, onRendered }: PreviewPaneProps) {
  const articleRef = useRef<HTMLElement>(null)
  const source = useDebouncedValue(content, 120)
  const { resolvedTheme } = useTheme()

  const { html, meta, headings } = useMemo(() => {
    const result = renderMarkdown(source)
    return { ...result, html: sanitizeHtml(result.html) }
  }, [source])

  useLayoutEffect(() => {
    const article = articleRef.current
    if (!article) return
    patchPreview(article, html)
    enhancePreview(article, resolvedTheme)
    onRendered?.()
  }, [html, resolvedTheme, onRendered])

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement

    if (target instanceof HTMLInputElement && target.classList.contains("task-list-item-checkbox")) {
      if (!onToggleTask) {
        event.preventDefault()
        return
      }
      const item = target.closest<HTMLElement>("li[data-source-line]")
      if (item) onToggleTask(Number(item.dataset.sourceLine))
      return
    }

    const copyButton = target.closest<HTMLElement>(".copy-button")
    if (copyButton) {
      copyCodeBlock(copyButton).catch(() => toast.error("Could not copy to clipboard"))
      return
    }

    const link = target.closest<HTMLAnchorElement>("a[href]")
    if (!link) return
    event.preventDefault()
    const href = link.getAttribute("href") ?? ""
    if (href.startsWith("#")) {
      const id = decodeURIComponent(href.slice(1))
      articleRef.current?.querySelector(`[id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: "smooth" })
    } else {
      // never navigate the editor away; external links open in a new tab
      window.open(link.href, "_blank", "noopener,noreferrer")
    }
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto bg-background">
      <div className={cn("mx-auto flex w-full justify-center gap-10 px-6 py-8 md:px-10", showToc && "max-w-[1240px]")}>
        <div className="w-full max-w-[860px] min-w-0">
          {meta.tags.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-1.5 text-muted-foreground">
              <TagIcon className="mr-0.5 size-3.5" aria-hidden />
              <span className="sr-only">Tags:</span>
              {meta.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground/80"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <article ref={articleRef} className="markdown-body" onClick={handleClick} />
        </div>
        {showToc && <DocumentToc headings={headings} scrollRef={scrollRef} articleRef={articleRef} />}
      </div>
    </div>
  )
}
