"use client"

import type { EditorView } from "@codemirror/view"
import { FileQuestionIcon } from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useGroupRef, type Layout } from "react-resizable-panels"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Skeleton } from "@/components/ui/skeleton"
import { useDoc, type SaveState } from "@/hooks/use-doc"
import { useIsMobile } from "@/hooks/use-mobile"
import { useScrollSync } from "@/hooks/use-scroll-sync"
import { downloadMarkdown, printDocument } from "@/lib/export"
import { getDocTitle } from "@/lib/title"
import { cn } from "@/lib/utils"

import { ExportPdfDialog } from "./export-pdf-dialog"
import { PreviewPane } from "./preview-pane"
import { Toolbar } from "./toolbar"
import {
  loadScrollSync,
  loadSplit,
  loadViewMode,
  saveScrollSync,
  saveSplit,
  saveViewMode,
  type ViewMode,
} from "./view-mode"

const EditorPane = dynamic(() => import("./editor-pane"), {
  ssr: false,
  loading: () => <div className="h-full bg-(--cm-bg)" />,
})

const MODE_SHORTCUTS: Record<string, ViewMode> = { KeyE: "edit", KeyB: "split", KeyV: "view" }
const TASK_MARKER = /^([\s>]*(?:[-*+]|\d+[.)])\s+\[)([ xX])\]/

function layoutFor(mode: ViewMode, split: number): Layout {
  if (mode === "edit") return { editor: 100, preview: 0 }
  if (mode === "view") return { editor: 0, preview: 100 }
  return { editor: split, preview: 100 - split }
}

export function Workspace({ id }: { id: string }) {
  const { load, content, setContent, saveState, flush } = useDoc(id)

  if (load.status === "loading") {
    return (
      <div className="flex h-full flex-col">
        <div className="h-12 border-b" />
        <div className="grid flex-1 grid-cols-2 gap-8 p-8">
          <div className="space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </div>
      </div>
    )
  }

  if (load.status === "missing") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <FileQuestionIcon className="size-10 text-muted-foreground" />
        <h1 className="text-lg font-medium">Document not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          It may have been deleted, or it lives in another browser. Documents are stored locally.
        </p>
        <Button asChild variant="outline">
          <Link href="/">Open my documents</Link>
        </Button>
      </div>
    )
  }

  return (
    <Editor
      initialContent={load.initialContent}
      content={content}
      setContent={setContent}
      saveState={saveState}
      flush={flush}
    />
  )
}

interface EditorProps {
  initialContent: string
  content: string
  setContent: (value: string) => void
  saveState: SaveState
  flush: () => Promise<void>
}

function Editor({ initialContent, content, setContent, saveState, flush }: EditorProps) {
  const isMobile = useIsMobile()
  const [mode, setModeState] = useState<ViewMode>(loadViewMode)
  const [scrollSync, setScrollSyncState] = useState(loadScrollSync)
  const [pdfOpen, setPdfOpen] = useState(false)
  const [view, setView] = useState<EditorView | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const [initialSplit] = useState(loadSplit)
  const splitRef = useRef(initialSplit)
  const groupRef = useGroupRef()

  // phones get Edit/View only; the chosen mode is kept for larger screens
  const effectiveMode: ViewMode = isMobile && mode === "split" ? "edit" : mode
  const title = useMemo(() => getDocTitle(content), [content])

  const setMode = useCallback((next: ViewMode) => {
    setModeState(next)
    saveViewMode(next)
  }, [])

  const setScrollSync = (enabled: boolean) => {
    setScrollSyncState(enabled)
    saveScrollSync(enabled)
  }

  useEffect(() => {
    document.title = `${title} · Andiko`
  }, [title])

  useEffect(() => {
    groupRef.current?.setLayout(layoutFor(effectiveMode, splitRef.current))
    if (effectiveMode !== "view") view?.focus()
  }, [effectiveMode, groupRef, view])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.altKey && MODE_SHORTCUTS[event.code]) {
        event.preventDefault()
        setMode(MODE_SHORTCUTS[event.code])
      } else if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault()
        flush().then(() => toast.success("Saved"))
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [flush, setMode])

  const invalidateScrollSync = useScrollSync(scrollSync && effectiveMode === "split", view, previewRef)

  const handleLayoutChanged = (layout: Layout, meta: { isUserInteraction: boolean }) => {
    if (!meta.isUserInteraction) return
    // dragging the divider all the way to one side switches mode
    if (layout.editor <= 0.5) setMode("view")
    else if (layout.preview <= 0.5) setMode("edit")
    else {
      splitRef.current = layout.editor
      saveSplit(layout.editor)
    }
  }

  const toggleTask = useCallback(
    (line: number) => {
      if (!view || line > view.state.doc.lines) return
      const text = view.state.doc.line(line)
      const match = TASK_MARKER.exec(text.text)
      if (!match) return
      const from = text.from + match[1].length
      view.dispatch({ changes: { from, to: from + 1, insert: match[2] === " " ? "x" : " " } })
    },
    [view],
  )

  const handlePrint = () => {
    printDocument(content).catch(() => toast.error("Could not prepare the document for printing"))
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Toolbar
        title={title}
        saveState={saveState}
        mode={effectiveMode}
        onModeChange={setMode}
        allowSplit={!isMobile}
        scrollSync={scrollSync}
        onScrollSyncChange={setScrollSync}
        onExportPdf={() => setPdfOpen(true)}
        onPrint={handlePrint}
        onDownloadMarkdown={() => downloadMarkdown(content, title)}
      />
      <ResizablePanelGroup
        groupRef={groupRef}
        defaultLayout={layoutFor(effectiveMode, initialSplit)}
        onLayoutChanged={handleLayoutChanged}
        className="min-h-0 flex-1"
      >
        <ResizablePanel id="editor" collapsible collapsedSize={0} minSize="20%">
          <div className="h-full" inert={effectiveMode === "view"}>
            <EditorPane initialValue={initialContent} onChange={setContent} onReady={setView} />
          </div>
        </ResizablePanel>
        <ResizableHandle
          disabled={effectiveMode !== "split"}
          // no grip; the hit area lights up on hover and while dragging
          className={cn(
            "after:transition-colors hover:after:bg-ring data-[separator=active]:after:bg-muted-foreground",
            effectiveMode !== "split" && "pointer-events-none opacity-0",
          )}
        />
        <ResizablePanel id="preview" collapsible collapsedSize={0} minSize="20%">
          <div className="h-full" inert={effectiveMode === "edit"}>
            <PreviewPane
              content={content}
              showToc={effectiveMode === "view"}
              scrollRef={previewRef}
              onToggleTask={toggleTask}
              onRendered={invalidateScrollSync}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      <ExportPdfDialog open={pdfOpen} onOpenChange={setPdfOpen} content={content} title={title} />
    </div>
  )
}
