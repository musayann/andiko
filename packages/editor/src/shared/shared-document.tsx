"use client"

import { CopyPlusIcon, FlagIcon, LoaderCircleIcon, PencilIcon, ScrollTextIcon, ShieldIcon } from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { createDoc, findDocByShareId, useLiveQuery } from "@andiko/core/db"
import { IS_DESKTOP_BUILD } from "@andiko/core/platform"
import { docPath, sharePath } from "@andiko/core/share/protocol"
import { contactEmail, privacyPolicy, siteUrl } from "@andiko/core/site"
import { Button } from "@andiko/ui/components/button"
import { LogoMark } from "@andiko/ui/components/logo"
import { Separator } from "@andiko/ui/components/separator"
import { Skeleton } from "@andiko/ui/components/skeleton"
import { ThemeSwitcher } from "@andiko/ui/components/theme-switcher"
import { Tooltip, TooltipContent, TooltipTrigger } from "@andiko/ui/components/tooltip"

import { useDocNav } from "../hooks/use-doc-nav"

// the preview sanitizes with DOMPurify, which needs the browser's DOM
const PreviewPane = dynamic(() => import("../workspace/preview-pane").then((mod) => mod.PreviewPane), {
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
  const nav = useDocNav()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [copying, setCopying] = useState(false)

  // undefined while loading, null when this browser doesn't have the original
  const originalId = useLiveQuery(async () => {
    try {
      return (await findDocByShareId(id))?.id ?? null
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
      if (IS_DESKTOP_BUILD) nav.open(docId)
      else router.push(`/d/${docId}`)
    } catch {
      toast.error("Couldn’t save a copy", {
        description: "Andiko stores documents in your browser (IndexedDB), which seems to be unavailable.",
      })
      setCopying(false)
    }
  }

  // Shared documents can contain anything, so anyone can report one to the instance's contact address.
  // The body asks for what a notice must contain under the DSA (Art. 16), as listed in /terms.
  const reportHref =
    contactEmail &&
    `mailto:${contactEmail}?subject=${encodeURIComponent(`Report: ${title}`)}&body=${encodeURIComponent(
      `Shared document: ${siteUrl}${sharePath(id, title)}\n\n` +
        "What is wrong with it and, if you think it is illegal, why:\n\n\n" +
        "Your name (optional for reports of child sexual abuse material):\n\n" +
        "I believe in good faith that this report is accurate and complete.\n",
    )}`

  return (
    <div className={IS_DESKTOP_BUILD ? "flex h-full flex-col" : "flex h-svh flex-col"}>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2 md:px-3">
        {/* in the desktop app this sits in a tab, under the app's own sidebar and tab bar */}
        {!IS_DESKTOP_BUILD && (
          <>
            <Link href="/" className="flex shrink-0 items-center gap-2 px-1 font-semibold tracking-tight">
              <LogoMark />
              <span className="hidden sm:inline">Andiko</span>
            </Link>
            <Separator orientation="vertical" className="mx-1 data-vertical:h-5 data-vertical:self-center" />
          </>
        )}
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium tracking-tight">{title}</h1>
        {!IS_DESKTOP_BUILD && <ThemeSwitcher className="hidden bg-muted sm:flex" />}
        {/* visitors who only open a shared link see no other page, so the policy and terms are linked here too */}
        {privacyPolicy && !IS_DESKTOP_BUILD && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" asChild className="text-muted-foreground hover:text-foreground">
                  <Link href="/privacy" aria-label="Privacy policy">
                    <ShieldIcon />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Privacy policy</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" asChild className="text-muted-foreground hover:text-foreground">
                  <Link href="/terms" aria-label="Terms of use">
                    <ScrollTextIcon />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Terms of use</TooltipContent>
            </Tooltip>
          </>
        )}
        {reportHref && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" asChild className="text-muted-foreground hover:text-foreground">
                <a href={reportHref} aria-label="Report this document">
                  <FlagIcon />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Report this document</TooltipContent>
          </Tooltip>
        )}
        {originalId ? (
          <Button size="sm" asChild>
            <Link
              href={docPath(originalId, id)}
              onClick={(event) => {
                if (!IS_DESKTOP_BUILD) return
                event.preventDefault()
                nav.open(originalId)
              }}
            >
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
                <TooltipContent>
                  Save an editable copy {IS_DESKTOP_BUILD ? "in your documents" : "in this browser"}
                </TooltipContent>
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
