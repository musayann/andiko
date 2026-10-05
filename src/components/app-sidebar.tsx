"use client"

import { useLiveQuery } from "dexie-react-hooks"
import {
  CopyIcon,
  FileDownIcon,
  FilePlusIcon,
  FileTextIcon,
  HardDriveIcon,
  MoreHorizontalIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { LogoMark } from "@/components/logo"
import { ThemeSwitcher } from "@/components/theme-switcher"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { createDoc, db, deleteDoc, duplicateDoc, type Doc } from "@/lib/db"
import { downloadMarkdown } from "@/lib/export"

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })

function formatUpdated(timestamp: number) {
  const seconds = Math.round((timestamp - Date.now()) / 1000)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ]
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relativeTime.format(Math.round(seconds / size), unit)
  }
  return "just now"
}

type DocSummary = Pick<Doc, "id" | "title" | "updatedAt">

const HEADER_BUTTON = "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"

// the open document is a raised card on the grey sidebar
const DOC_BUTTON =
  "h-auto gap-2.5 rounded-lg px-2.5 py-2 data-active:bg-background data-active:shadow-xs data-active:ring-1 data-active:ring-sidebar-border data-active:hover:bg-background"

export function AppSidebar() {
  const router = useRouter()
  const params = useParams<{ id?: string }>()
  const activeId = params.id
  const [query, setQuery] = useState("")
  const [pendingDelete, setPendingDelete] = useState<DocSummary | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const docs = useLiveQuery(async () => {
    const all = await db.docs.orderBy("updatedAt").reverse().toArray()
    return all.map(({ id, title, updatedAt }): DocSummary => ({ id, title, updatedAt }))
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? docs?.filter((doc) => doc.title.toLowerCase().includes(needle)) : docs
  }, [docs, query])

  const handleNew = async () => {
    const id = await createDoc()
    router.push(`/d/${id}`)
  }

  const handleImport = async (files: FileList | null) => {
    if (!files?.length) return
    let firstId: string | undefined
    for (const file of Array.from(files)) {
      const id = await createDoc(await file.text())
      firstId ??= id
    }
    toast.success(files.length === 1 ? `Imported ${files[0].name}` : `Imported ${files.length} files`)
    if (firstId) router.push(`/d/${firstId}`)
  }

  const handleDuplicate = async (doc: DocSummary) => {
    const id = await duplicateDoc(doc.id)
    if (id) router.push(`/d/${id}`)
  }

  const handleDownload = async (doc: DocSummary) => {
    const full = await db.docs.get(doc.id)
    if (full) downloadMarkdown(full.content, full.title)
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    const { id, title } = pendingDelete
    setPendingDelete(null)
    await deleteDoc(id)
    toast.success(`Deleted “${title}”`)
    if (id === activeId) {
      const next = docs?.find((doc) => doc.id !== id)
      router.replace(next ? `/d/${next.id}` : `/d/${await createDoc()}`)
    }
  }

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="gap-3">
        <div className="flex items-center justify-between px-1 pt-1">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <LogoMark />
            Andiko
          </Link>
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Import Markdown"
                  onClick={() => fileInputRef.current?.click()}
                  className={HEADER_BUTTON}
                >
                  <UploadIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Import .md files</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="New document" onClick={handleNew} className={HEADER_BUTTON}>
                  <FilePlusIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New document</TooltipContent>
            </Tooltip>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain"
            multiple
            hidden
            onChange={(event) => {
              void handleImport(event.target.files)
              event.target.value = ""
            }}
          />
        </div>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <SidebarInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents"
            className="border-sidebar-border pl-8 shadow-xs"
            aria-label="Search documents"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Documents</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filtered === undefined &&
                // fixed widths: SidebarMenuSkeleton's random widths break hydration
                ["80%", "65%", "72%", "58%"].map((width) => (
                  <SidebarMenuItem key={width} className="px-2 py-2">
                    <Skeleton className="h-4" style={{ width }} />
                  </SidebarMenuItem>
                ))}
              {filtered?.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  {query ? "No matching documents" : "No documents yet"}
                </p>
              )}
              {filtered?.map((doc) => (
                <SidebarMenuItem key={doc.id}>
                  <SidebarMenuButton asChild isActive={doc.id === activeId} className={DOC_BUTTON}>
                    <Link href={`/d/${doc.id}`}>
                      <FileTextIcon className="mt-0.5 self-start text-muted-foreground group-data-active/menu-button:text-foreground" />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{doc.title}</span>
                        <span className="text-xs text-muted-foreground">{formatUpdated(doc.updatedAt)}</span>
                      </span>
                    </Link>
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction showOnHover aria-label={`Actions for ${doc.title}`}>
                        <MoreHorizontalIcon />
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" className="w-44">
                      <DropdownMenuItem onSelect={() => void handleDuplicate(doc)}>
                        <CopyIcon />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void handleDownload(doc)}>
                        <FileDownIcon />
                        Download .md
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setPendingDelete(doc)}>
                        <Trash2Icon />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-2">
          <span className="text-xs text-muted-foreground">Theme</span>
          <ThemeSwitcher />
        </div>
        <p className="flex items-center gap-2 px-2 pb-1 text-xs text-muted-foreground">
          <HardDriveIcon className="size-3.5" />
          Documents are stored in this browser
        </p>
      </SidebarFooter>
      <SidebarRail />

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the document from this browser. Download it first if you want a copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void confirmDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  )
}
