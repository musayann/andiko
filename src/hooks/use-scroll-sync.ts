import type { EditorView } from "@codemirror/view"
import { useCallback, useEffect, useRef, type RefObject } from "react"

import {
  collectAnchors,
  editorLineAt,
  editorOffsetOf,
  editorScrollHeight,
  lineToOffset,
  offsetToLine,
  syncedScrollTop,
  type LineAnchor,
  type ScrollPane,
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

    const editorPane = (): ScrollPane => ({
      scrollTop: view.scrollDOM.scrollTop,
      clientHeight: view.scrollDOM.clientHeight,
      scrollHeight: editorScrollHeight(view),
      lineAt: (y) => editorLineAt(view, y),
      offsetOf: (line) => editorOffsetOf(view, line),
    })
    const previewPane = (): ScrollPane => ({
      scrollTop: preview.scrollTop,
      clientHeight: preview.clientHeight,
      scrollHeight: preview.scrollHeight,
      lineAt: (y) => offsetToLine(anchors(), y),
      offsetOf: (line) => lineToOffset(anchors(), line),
    })

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
        ignore("preview")
        preview.scrollTop = syncedScrollTop(editorPane(), previewPane())
      })
    }

    const onPreviewScroll = () => {
      if (ignored === "preview") return
      schedule(() => {
        ignore("editor")
        view.scrollDOM.scrollTop = syncedScrollTop(previewPane(), editorPane())
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
