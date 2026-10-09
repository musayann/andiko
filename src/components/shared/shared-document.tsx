"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { CopyPlusIcon, LoaderCircleIcon, PencilIcon } from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { LogoMark } from "@/components/logo"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { createDoc, db } from "@/lib/db"

// the preview sanitizes with DOMPurify, which needs the browser's DOM
const PreviewPane = dynamic(() => import("@/components/workspace/preview-pane").then((mod) => mod.PreviewPane), {
  ssr: false,
  loading: () => (
    <div className="mx-auto w-full max-w-[860px] space-y-3 px-6 py-8 md:px-10">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/6" />
    </div>
  ),
})

interface SharedDocumentProps {
  id: string
  title: string
  content: string
}

/**
 * Read-only view of a published document. The browser that published it gets
 * a link back to its local original; everyone else can save an editable copy,
 * which never changes the published one.
 */
export function SharedDocument({ id, title, content }: SharedDocumentProps) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [copying, setCopying] = useState(false)

  // undefined while loading, null when this browser doesn't have the original
  const originalId = useLiveQuery(async () => {
    try {
      return (await db.docs.where("shareId").equals(id).first())?.id ?? null
    } catch {
      // IndexedDB unavailable (private mode)
      return null
    }
  }, [id])

  const handleCopy = async () => {
    setCopying(true)
    try {
      // the title doubles as the fallback name, for content without a heading
      const docId = await createDoc(content, undefined, title)
      toast.success("Saved a copy to your documents")
      router.push(`/d/${docId}`)
    } catch {
      toast.error("Couldn’t save a copy", {
        description: "Andiko stores documents in your browser (IndexedDB), which seems to be unavailable.",
      })
      setCopying(false)
    }
  }

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2 md:px-3">
        <Link href="/" className="flex shrink-0 items-center gap-2 px-1 font-semibold tracking-tight">
          <LogoMark />
          <span className="hidden sm:inline">Andiko</span>
        </Link>
        <Separator orientation="vertical" className="mx-1 data-vertical:h-5 data-vertical:self-center" />
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium tracking-tight">{title}</h1>
        <ThemeSwitcher className="hidden bg-muted sm:flex" />
        {originalId ? (
          <Button size="sm" asChild>
            <Link href={`/d/${originalId}`}>
              <PencilIcon />
              Edit
            </Link>
          </Button>
        ) : (
          originalId === null && (
            <>
              <span className="hidden text-xs text-muted-foreground md:inline">Read-only</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" onClick={() => void handleCopy()} disabled={copying}>
                    {copying ? <LoaderCircleIcon className="animate-spin" /> : <CopyPlusIcon />}
                    Make a copy
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save an editable copy in this browser</TooltipContent>
              </Tooltip>
            </>
          )
        )}
      </header>
      <div className="min-h-0 flex-1">
        <PreviewPane content={content} showToc scrollRef={scrollRef} />
      </div>
    </div>
  )
}
