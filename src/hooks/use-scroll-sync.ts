import type { EditorView } from "@codemirror/view"
import { useCallback, useEffect, useRef, type RefObject } from "react"

import {
  collectAnchors,
  editorTopLine,
  isAtBottom,
  lineToOffset,
  offsetToLine,
  scrollEditorToLine,
  type LineAnchor,
} from "@/lib/scroll-sync"

type Pane = "editor" | "preview"

/**
 * Keeps the editor and preview scrolled to the same place,
 * using the preview's `data-source-line` anchors. Returns `invalidate`, to be
 * called whenever the preview re-renders.
 */
export function useScrollSync(
  enabled: boolean,
  view: EditorView | null,
  previewRef: RefObject<HTMLDivElement | null>,
) {
  const anchorsRef = useRef<LineAnchor[] | null>(null)
  const invalidate = useCallback(() => {
    anchorsRef.current = null
  }, [])

  useEffect(() => {
    const preview = previewRef.current
    const article = preview?.querySelector<HTMLElement>(".markdown-body")
    if (!enabled || !view || !preview || !article) return

    const anchors = () => (anchorsRef.current ??= collectAnchors(preview, article, view.state.doc.lines))

    // scrolling one pane programmatically fires its scroll event; ignore those echoes
    let ignored: Pane | null = null
    let ignoreTimer: ReturnType<typeof setTimeout> | undefined
    const ignore = (pane: Pane) => {
      ignored = pane
      clearTimeout(ignoreTimer)
      ignoreTimer = setTimeout(() => (ignored = null), 120)
    }

    let frame = 0
    const schedule = (task: () => void) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(task)
    }

    const onEditorScroll = () => {
      if (ignored === "editor") return
      schedule(() => {
        const scroller = view.scrollDOM
        const top =
          scroller.scrollTop <= 0
            ? 0
            : isAtBottom(scroller)
              ? preview.scrollHeight
              : lineToOffset(anchors(), editorTopLine(view))
        ignore("preview")
        preview.scrollTop = top
      })
    }

    const onPreviewScroll = () => {
      if (ignored === "preview") return
      schedule(() => {
        ignore("editor")
        if (preview.scrollTop <= 0) view.scrollDOM.scrollTop = 0
        else if (isAtBottom(preview)) view.scrollDOM.scrollTop = view.scrollDOM.scrollHeight
        else scrollEditorToLine(view, offsetToLine(anchors(), preview.scrollTop))
      })
    }

    const resizeObserver = new ResizeObserver(invalidate)
    resizeObserver.observe(article)
    resizeObserver.observe(preview)
    // images change the layout when they finish loading
    article.addEventListener("load", invalidate, true)
    view.scrollDOM.addEventListener("scroll", onEditorScroll, { passive: true })
    preview.addEventListener("scroll", onPreviewScroll, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(ignoreTimer)
      resizeObserver.disconnect()
      article.removeEventListener("load", invalidate, true)
      view.scrollDOM.removeEventListener("scroll", onEditorScroll)
      preview.removeEventListener("scroll", onPreviewScroll)
    }
  }, [enabled, view, previewRef, invalidate])

  return invalidate
}
