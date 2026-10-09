"use client"

import { useLiveQuery } from "dexie-react-hooks"
import {
  DownloadIcon,
  FilePlusIcon,
  FolderPlusIcon,
  HardDriveIcon,
  SearchIcon,
  UploadIcon,
} from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { LogoMark } from "@/components/logo"
import { DocItem } from "@/components/sidebar/doc-item"
import { DeleteFolderDialog, FolderNameDialog, type FolderDeletion } from "@/components/sidebar/folder-dialogs"
import { FolderItem } from "@/components/sidebar/folder-item"
import {
  SidebarTreeContext,
  useDropTarget,
  useSidebarTree,
  type DropTarget,
  type SidebarTree,
  type TreeItem,
} from "@/components/sidebar/tree-context"
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
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { parseArchive, safeName, stripExtension, zipTree } from "@/lib/archive"
import {
  createDoc,
  createFolder,
  db,
  deleteDoc,
  deleteFolder,
  duplicateDoc,
  importFolder,
  moveDoc,
  moveFolder,
  renameFolder,
  type Folder,
} from "@/lib/db"
import { downloadMarkdown, downloadZip } from "@/lib/export"
import {
  buildTree,
  canMoveFolder,
  collectDocs,
  countDocs,
  descendantIds,
  folderChain,
  folderPath,
  loadExpanded,
  saveExpanded,
  type DocSummary,
  type FolderNode,
} from "@/lib/folders"
import { shareUrl, unpublishDocs } from "@/lib/share/client"
import { privacyPolicy } from "@/lib/site"
import { cn } from "@/lib/utils"

const HEADER_BUTTON = "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
const FOOTER_LINK =
  "flex items-center gap-2 rounded-sm font-medium underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-sidebar-ring"
const LEGAL_LINK =
  "rounded-sm underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-sidebar-ring"

const isZip = (file: File) => /\.zip$/i.test(file.name)

type NameDialog = { mode: "create"; parentId?: string; moveInto?: TreeItem } | { mode: "rename"; folder: Folder }

export function AppSidebar() {
  const router = useRouter()
  const params = useParams<{ id?: string }>()
  const activeId = params.id
  const [query, setQuery] = useState("")
  const [pendingDelete, setPendingDelete] = useState<DocSummary | null>(null)
  const [pendingFolderDelete, setPendingFolderDelete] = useState<FolderNode<DocSummary> | null>(null)
  const [nameDialog, setNameDialog] = useState<NameDialog | null>(null)
  const [expanded, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set(loadExpanded()))
  const [revealedFor, setRevealedFor] = useState<string>()
  const [dragging, setDragging] = useState<TreeItem | null>(null)
  const [hovered, setHovered] = useState<DropTarget | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // where the picked files go; set each time the picker opens
  const importTarget = useRef<string | undefined>(undefined)

  const data = useLiveQuery(async () => {
    const docs = await db.docs.orderBy("updatedAt").reverse().toArray()
    const folders = await db.folders.toArray()
    return {
      docs: docs.map(
        ({ id, title, updatedAt, folderId, shareId }): DocSummary => ({ id, title, updatedAt, folderId, shareId }),
      ),
      folders,
    }
  }, [])
  const docs = data?.docs
  const folders = useMemo(() => data?.folders ?? [], [data])
  const tree = useMemo(() => buildTree(folders, docs ?? []), [folders, docs])

  const searching = query.trim() !== ""
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return docs?.filter((doc) => doc.title.toLowerCase().includes(needle))
  }, [docs, query])

  useEffect(() => saveExpanded(expanded), [expanded])

  const setExpanded = useCallback((id: string, open: boolean) => {
    setExpandedIds((prev) => {
      if (prev.has(id) === open) return prev
      const next = new Set(prev)
      if (open) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const expandAll = useCallback((ids: string[]) => {
    setExpandedIds((prev) => (ids.every((id) => prev.has(id)) ? prev : new Set([...prev, ...ids])))
  }, [])

  // open the folders around the current document, once per document so it can still be collapsed
  const activeDoc = docs?.find((doc) => doc.id === activeId)
  if (activeDoc && revealedFor !== activeDoc.id) {
    setRevealedFor(activeDoc.id)
    expandAll(folderChain(folders, activeDoc.folderId).map((folder) => folder.id))
  }

  const canMove = useCallback(
    (item: TreeItem, folderId: string | undefined) =>
      item.parentId !== folderId && (item.kind === "doc" || canMoveFolder(folders, item.id, folderId)),
    [folders],
  )

  const move = useCallback(
    async (item: TreeItem, folderId: string | undefined) => {
      if (item.kind === "doc") await moveDoc(item.id, folderId)
      else if (!(await moveFolder(item.id, folderId))) {
        toast.error("A folder can’t be moved into itself")
        return
      }
      expandAll(folderChain(folders, folderId).map((folder) => folder.id))
    },
    [expandAll, folders],
  )

  const handleNew = async (folderId?: string) => {
    const id = await createDoc("", folderId)
    router.push(`/d/${id}`)
  }

  const openImport = (folderId?: string) => {
    importTarget.current = folderId
    fileInputRef.current?.click()
  }

  /** Markdown files become documents; each zip becomes a folder of them. */
  const handleImport = async (files: FileList | null) => {
    if (!files?.length) return
    const folderId = importTarget.current
    const docIds: string[] = []
    const newFolderIds: string[] = []
    for (const file of Array.from(files)) {
      if (!isZip(file)) {
        docIds.push(await createDoc(await file.text(), folderId, stripExtension(file.name)))
        continue
      }
      try {
        const archive = parseArchive(new Uint8Array(await file.arrayBuffer()), file.name)
        const imported = await importFolder(archive, folderId)
        docIds.push(...imported.docIds)
        newFolderIds.push(imported.folderIds[0])
      } catch (error) {
        toast.error(`Couldn’t import ${file.name}`, { description: error instanceof Error ? error.message : undefined })
      }
    }
    if (docIds.length === 0) return
    expandAll([...folderChain(folders, folderId).map((folder) => folder.id), ...newFolderIds])
    toast.success(
      files.length === 1 && !isZip(files[0])
        ? `Imported ${files[0].name}`
        : `Imported ${docIds.length} document${docIds.length === 1 ? "" : "s"}`,
    )
    router.push(`/d/${docIds[0]}`)
  }

  const handleExportFolder = async ({ folder }: FolderNode<DocSummary>) => {
    const ids = new Set([folder.id, ...descendantIds(folders, folder.id)])
    const contents = await db.docs.where("folderId").anyOf([...ids]).toArray()
    // the folder's parent is left out, so it is the tree's only top-level folder
    const subtree = buildTree(folders.filter((candidate) => ids.has(candidate.id)), contents)
    downloadZip(zipTree(subtree), safeName(folder.name, "folder"))
  }

  const handleExportAll = async () => {
    const all = await db.docs.toArray()
    if (all.length === 0 && folders.length === 0) {
      toast("Nothing to export")
      return
    }
    // sv-SE formats the local date as YYYY-MM-DD
    downloadZip(zipTree(buildTree(folders, all)), `andiko-${new Date().toLocaleDateString("sv-SE")}`)
  }

  const handleDuplicate = async (doc: DocSummary) => {
    const id = await duplicateDoc(doc.id)
    if (id) router.push(`/d/${id}`)
  }

  const handleDownload = async (doc: DocSummary) => {
    const full = await db.docs.get(doc.id)
    if (full) downloadMarkdown(full.content, full.title)
  }

  const handleCopyLink = async (doc: DocSummary) => {
    if (!doc.shareId) return
    try {
      await navigator.clipboard.writeText(shareUrl(doc.shareId, doc.title))
      toast.success("Link copied")
    } catch {
      toast.error("Could not copy to clipboard")
    }
  }

  /** Takes published documents offline before deleting them. False (and nothing deleted) when that fails. */
  const unpublishBeforeDelete = async (shared: DocSummary[]) => {
    if (shared.length === 0) return true
    try {
      await unpublishDocs(shared.map((doc) => doc.id))
      return true
    } catch (error) {
      toast.error("Couldn’t unpublish, so nothing was deleted", {
        description: error instanceof Error ? error.message : undefined,
      })
      return false
    }
  }

  /** Navigates away when the open document was just deleted. */
  const leaveIfDeleted = async (deletedIds: string[]) => {
    if (!activeId || !deletedIds.includes(activeId)) return
    const next = docs?.find((doc) => !deletedIds.includes(doc.id))
    router.replace(next ? `/d/${next.id}` : `/d/${await createDoc()}`)
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    const { id, title } = pendingDelete
    setPendingDelete(null)
    if (!(await unpublishBeforeDelete(pendingDelete.shareId ? [pendingDelete] : []))) return
    await deleteDoc(id)
    toast.success(`Deleted “${title}”`)
    await leaveIfDeleted([id])
  }

  const confirmDeleteFolder = async (withContents: boolean) => {
    if (!pendingFolderDelete) return
    const { folder } = pendingFolderDelete
    const removedFolders = new Set([folder.id, ...(withContents ? descendantIds(folders, folder.id) : [])])
    setPendingFolderDelete(null)
    // "folder only" moves the documents up, so they stay published
    const shared = withContents ? collectDocs(pendingFolderDelete).filter((doc) => doc.shareId) : []
    if (!(await unpublishBeforeDelete(shared))) return
    const deletedDocs = await deleteFolder(folder.id, { withContents })
    setExpandedIds((prev) => new Set([...prev].filter((id) => !removedFolders.has(id))))
    toast.success(
      deletedDocs.length
        ? `Deleted “${folder.name}” and ${deletedDocs.length} document${deletedDocs.length === 1 ? "" : "s"}`
        : `Deleted “${folder.name}”`,
    )
    await leaveIfDeleted(deletedDocs)
  }

  const folderDeletion = useMemo((): FolderDeletion | null => {
    if (!pendingFolderDelete) return null
    const { folder } = pendingFolderDelete
    const parent = folders.find((candidate) => candidate.id === folder.parentId)
    return {
      name: folder.name,
      docCount: countDocs(pendingFolderDelete),
      folderCount: descendantIds(folders, folder.id).size,
      sharedCount: collectDocs(pendingFolderDelete).filter((doc) => doc.shareId).length,
      destination: parent ? `“${parent.name}”` : "the top level",
    }
  }, [pendingFolderDelete, folders])

  const submitName = async (name: string) => {
    const dialog = nameDialog
    setNameDialog(null)
    if (!dialog) return
    if (dialog.mode === "rename") {
      await renameFolder(dialog.folder.id, name)
      return
    }
    const id = await createFolder(name, dialog.parentId)
    expandAll(folderChain(folders, dialog.parentId).map((folder) => folder.id))
    if (dialog.moveInto) {
      await move(dialog.moveInto, id)
      setExpanded(id, true)
    }
  }

  const context: SidebarTree = {
    activeId,
    tree,
    isExpanded: (id) => expanded.has(id),
    setExpanded,
    dragging,
    setDragging,
    hovered,
    setHovered,
    canMove,
    move: (item, folderId) => void move(item, folderId),
    onNewDoc: (folderId) => void handleNew(folderId),
    onDuplicateDoc: (doc) => void handleDuplicate(doc),
    onDownloadDoc: (doc) => void handleDownload(doc),
    onCopyDocLink: (doc) => void handleCopyLink(doc),
    onDeleteDoc: setPendingDelete,
    onNewFolder: (parentId, moveInto) => setNameDialog({ mode: "create", parentId, moveInto }),
    onRenameFolder: (folder) => setNameDialog({ mode: "rename", folder }),
    onExportFolder: (node) => void handleExportFolder(node),
    onImportInto: openImport,
    onDeleteFolder: setPendingFolderDelete,
  }

  const newFolderParent = nameDialog?.mode === "create" ? folderPath(folders, nameDialog.parentId) : ""

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
                  onClick={() => openImport()}
                  className={HEADER_BUTTON}
                >
                  <UploadIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Import .md or .zip files</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="New folder"
                  onClick={() => setNameDialog({ mode: "create" })}
                  className={HEADER_BUTTON}
                >
                  <FolderPlusIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New folder</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="New document"
                  onClick={() => void handleNew()}
                  className={HEADER_BUTTON}
                >
                  <FilePlusIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New document</TooltipContent>
            </Tooltip>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.mdown,.txt,.zip,text/markdown,text/plain,application/zip"
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
        <SidebarTreeContext value={context}>
          {/* while searching, matches are listed flat, so there is nothing to drop onto */}
          <DocumentsGroup droppable={!searching}>
            <SidebarGroupLabel>Documents</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {data === undefined &&
                  // fixed widths: SidebarMenuSkeleton's random widths break hydration
                  ["80%", "65%", "72%", "58%"].map((width) => (
                    <SidebarMenuItem key={width} className="px-2 py-2">
                      <Skeleton className="h-4" style={{ width }} />
                    </SidebarMenuItem>
                  ))}
                {data !== undefined &&
                  (searching ? matches?.length === 0 : tree.folders.length === 0 && tree.docs.length === 0) && (
                    <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                      {searching ? "No matching documents" : "No documents yet"}
                    </p>
                  )}
                {searching
                  ? matches?.map((doc) => <DocItem key={doc.id} doc={doc} path={folderPath(folders, doc.folderId)} />)
                  : data !== undefined && (
                      <>
                        {tree.folders.map((node) => (
                          <FolderItem key={node.folder.id} node={node} />
                        ))}
                        {tree.docs.map((doc) => (
                          <DocItem key={doc.id} doc={doc} />
                        ))}
                      </>
                    )}
              </SidebarMenu>
            </SidebarGroupContent>
          </DocumentsGroup>
        </SidebarTreeContext>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-2">
          <span className="text-xs text-muted-foreground">Theme</span>
          <ThemeSwitcher />
        </div>
        <div className="flex flex-col items-start gap-1.5 px-2 pb-1 text-xs text-muted-foreground">
          <p className="flex gap-2">
            <HardDriveIcon className="mt-px size-3.5 shrink-0" />
            Documents are stored in this browser
          </p>
          <button
            type="button"
            onClick={() => void handleExportAll()}
            className={FOOTER_LINK}
          >
            <DownloadIcon className="size-3.5 shrink-0" />
            Export all as .zip
          </button>
        </div>
        {privacyPolicy && (
          <nav aria-label="Legal" className="flex gap-3 px-2 pb-1 text-[11px] text-muted-foreground/80">
            <Link href="/privacy" className={LEGAL_LINK}>
              Privacy
            </Link>
            <Link href="/terms" className={LEGAL_LINK}>
              Terms
            </Link>
          </nav>
        )}
      </SidebarFooter>
      <SidebarRail />

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the document from this browser. Download it first if you want a copy.
              {pendingDelete?.shareId && " Its public link will stop working too."}
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

      <DeleteFolderDialog
        target={folderDeletion}
        onOpenChange={(open) => !open && setPendingFolderDelete(null)}
        onConfirm={(withContents) => void confirmDeleteFolder(withContents)}
      />

      <FolderNameDialog
        open={nameDialog !== null}
        onOpenChange={(open) => !open && setNameDialog(null)}
        title={nameDialog?.mode === "rename" ? "Rename folder" : "New folder"}
        description={newFolderParent ? `Inside “${newFolderParent}”` : undefined}
        submitLabel={nameDialog?.mode === "rename" ? "Rename" : "Create"}
        defaultName={nameDialog?.mode === "rename" ? nameDialog.folder.name : ""}
        onSubmit={(name) => void submitName(name)}
      />
    </Sidebar>
  )
}

/** The document list; areas outside any folder are the drop zone for the top level. */
function DocumentsGroup({ droppable, children }: { droppable: boolean; children: ReactNode }) {
  const { setHovered } = useSidebarTree()
  const drop = useDropTarget(undefined)

  return (
    <SidebarGroup
      className={cn("flex-1 rounded-lg transition-colors", droppable && drop.highlight && "bg-sidebar-accent/60")}
      {...(droppable ? drop.props : {})}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovered(null)
      }}
    >
      {children}
    </SidebarGroup>
  )
}
