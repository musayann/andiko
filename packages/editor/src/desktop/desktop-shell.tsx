"use client"

import { LoaderCircleIcon } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { createDraft, getDoc, getDocs, resolveStartDoc } from "@andiko/core/db"
import { printDocument } from "@andiko/core/export"
import { openExternal } from "@andiko/core/platform"
import { parseAndikoLink } from "@andiko/core/share/public"
import { legalLinks, repoUrl, siteUrl } from "@andiko/core/site"
import {
  closeTab,
  closeTabs,
  cycleTab,
  getTabs,
  openDocTab,
  openPublicTab,
  selectTabNumber,
  tabKey,
  useTabs,
} from "@andiko/core/tabs"

import { Workspace } from "../workspace/workspace"
import { openAndikoLink, openLink } from "./links"
import { OpenLinkDialog } from "./open-link-dialog"
import { PublicTab } from "./public-tab"
import { TabBar } from "./tab-bar"
import { checkForUpdates, useUpdates } from "./updates"

const SELECT_TAB = /^select-tab-([1-9])$/

/** The Help menu's links (see src-tauri/src/lib.rs), opened in the browser. */
const HELP_LINKS: Record<string, string | undefined> = {
  website: siteUrl,
  "report-issue": `${repoUrl}/issues/new`,
  "privacy-policy": legalLinks?.privacy,
  "terms-of-use": legalLinks?.terms,
}

/** Opens the document tabs from last time, dropping those whose document is gone; a first run gets the start document. */
async function restoreTabs() {
  const docIds = getTabs().tabs.flatMap((tab) => (tab.kind === "doc" ? [tab.docId] : []))
  const found = new Set((await getDocs(docIds)).flatMap((doc) => (doc ? [doc.id] : [])))
  closeTabs((tab) => tab.kind === "doc" && !found.has(tab.docId))
  if (getTabs().tabs.length === 0) openDocTab(await resolveStartDoc())
}

function newDocumentTab() {
  openDocTab(createDraft())
}

async function printActiveDocument() {
  const { tabs, active } = getTabs()
  const tab = tabs.find((candidate) => tabKey(candidate) === active)
  if (tab?.kind !== "doc") return
  const doc = await getDoc(tab.docId)
  if (doc) await printDocument(doc.content)
}

/** Reacts to the native menu (see src-tauri/src/lib.rs), which owns the tab shortcuts. */
function useMenuEvents(onOpenLink: () => void) {
  useEffect(() => {
    let unlisten: (() => void) | undefined
    let cancelled = false

    const handle = (id: string) => {
      const select = SELECT_TAB.exec(id)
      const helpLink = HELP_LINKS[id]
      if (select) selectTabNumber(Number(select[1]))
      else if (id === "new-tab") newDocumentTab()
      else if (id === "open-link") onOpenLink()
      else if (id === "close-tab") {
        const { active } = getTabs()
        if (active) closeTab(active)
      } else if (id === "next-tab") cycleTab(1)
      else if (id === "previous-tab") cycleTab(-1)
      else if (id === "print") printActiveDocument().catch(() => toast.error("Could not print the document"))
      else if (id === "check-updates") void checkForUpdates(true)
      else if (helpLink) void openExternal(helpLink)
    }

    void import("@tauri-apps/api/event").then(async ({ listen }) => {
      const stop = await listen<string>("menu", (event) => handle(event.payload))
      if (cancelled) stop()
      else unlisten = stop
    })

    // Ctrl+Tab isn't a menu shortcut, so the page sees it
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "Tab") {
        event.preventDefault()
        cycleTab(event.shiftKey ? -1 : 1)
      }
    }
    window.addEventListener("keydown", onKeyDown)

    return () => {
      cancelled = true
      unlisten?.()
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [onOpenLink])
}

/** Opens links that leave the app (https:, mailto:) in a tab when they point at Andiko, else in the system's default handler, never in the webview. */
function useExternalLinks() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]")
      if (!link || event.defaultPrevented) return
      const url = new URL(link.href, location.href)
      if (url.origin === location.origin && url.protocol !== "mailto:") return
      event.preventDefault()
      void openLink(url.href)
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])
}

/**
 * Keeps a file dragged in from Finder from loading in the webview. Tauri's own drop handling is off
 * (dragDropEnabled in src-tauri/tauri.conf.json) so the sidebar and tab bar can drag, which leaves
 * file drops to WebKit; only the editor takes them, reading the file's text in.
 */
function useFileDropGuard() {
  useEffect(() => {
    const onDrag = (event: DragEvent) => {
      if (event.defaultPrevented || !event.dataTransfer?.types.includes("Files")) return
      if (event.target instanceof HTMLElement && event.target.isContentEditable) return
      event.preventDefault()
      event.dataTransfer.dropEffect = "none"
    }
    window.addEventListener("dragover", onDrag)
    window.addEventListener("drop", onDrag)
    return () => {
      window.removeEventListener("dragover", onDrag)
      window.removeEventListener("drop", onDrag)
    }
  }, [])
}

/**
 * Keeps the webview's own menu (Reload, Inspect Element…) from showing on right-click. Places with
 * app actions show a native menu instead (see context-menu.ts); text fields keep their Cut/Copy/Paste.
 */
function useContextMenuGuard() {
  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      if (event.target instanceof Element && event.target.closest("input, textarea")) return
      // Shift+right-click still reaches Inspect Element while developing
      if (process.env.NODE_ENV === "development" && event.shiftKey) return
      event.preventDefault()
    }
    window.addEventListener("contextmenu", onContextMenu)
    return () => window.removeEventListener("contextmenu", onContextMenu)
  }, [])
}

/** Opens the andiko:// links the system hands the app (the scheme is registered in src-tauri/tauri.conf.json). */
function openDeepLinks(urls: string[] | null) {
  for (const url of urls ?? []) {
    const link = parseAndikoLink(url)
    if (link) void openAndikoLink(link)
  }
}

/** Opens the link the app was launched with, if any; useDeepLinks takes those that come while it runs. */
async function openLaunchLink() {
  const { getCurrent } = await import("@tauri-apps/plugin-deep-link")
  openDeepLinks(await getCurrent())
}

function useDeepLinks() {
  useEffect(() => {
    let unlisten: (() => void) | undefined
    let cancelled = false

    void import("@tauri-apps/plugin-deep-link").then(async ({ onOpenUrl }) => {
      const stop = await onOpenUrl(openDeepLinks)
      if (cancelled) stop()
      else unlisten = stop
    })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])
}

/** The desktop app's content area: a tab bar over the active tab. Only that tab's editor is mounted. */
export function DesktopShell() {
  const { tabs, active } = useTabs()
  const [linkOpen, setLinkOpen] = useState(false)
  const openLinkDialog = useCallback(() => setLinkOpen(true), [])

  useMenuEvents(openLinkDialog)
  useExternalLinks()
  useFileDropGuard()
  useContextMenuGuard()
  useDeepLinks()
  useUpdates()

  useEffect(() => {
    restoreTabs()
      .catch(() => toast.error("Could not open your documents"))
      // after the restored tabs, so the linked document ends up in front
      .then(openLaunchLink)
  }, [])

  const tab = tabs.find((candidate) => tabKey(candidate) === active)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TabBar tabs={tabs} active={active} onNew={newDocumentTab} onOpenLink={openLinkDialog} />
      <div className="min-h-0 flex-1">
        {/* keyed so switching tabs remounts the editor with fresh state, as switching routes does on the web */}
        {tab?.kind === "doc" && <Workspace key={tabKey(tab)} id={tab.docId} sharing />}
        {tab?.kind === "public" && <PublicTab key={tabKey(tab)} shareId={tab.shareId} />}
        {!tab && (
          <div className="grid h-full place-items-center text-muted-foreground">
            <LoaderCircleIcon className="size-5 animate-spin" aria-label="Loading" />
          </div>
        )}
      </div>
      <OpenLinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        onOpen={(shareId) => {
          openPublicTab(shareId)
          setLinkOpen(false)
        }}
      />
    </div>
  )
}
