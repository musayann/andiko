"use client"

import { LoaderCircleIcon } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { createDoc, db, resolveStartDoc } from "@andiko/core/db"
import { printDocument } from "@andiko/core/export"
import { parseAndikoLink } from "@andiko/core/share/public"
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

const SELECT_TAB = /^select-tab-([1-9])$/

/** Opens the document tabs from last time, dropping those whose document is gone; a first run gets the start document. */
async function restoreTabs() {
  const docIds = getTabs().tabs.flatMap((tab) => (tab.kind === "doc" ? [tab.docId] : []))
  const found = new Set((await db.docs.bulkGet(docIds)).flatMap((doc) => (doc ? [doc.id] : [])))
  closeTabs((tab) => tab.kind === "doc" && !found.has(tab.docId))
  if (getTabs().tabs.length === 0) openDocTab(await resolveStartDoc())
}

async function newDocumentTab() {
  openDocTab(await createDoc(""))
}

async function printActiveDocument() {
  const { tabs, active } = getTabs()
  const tab = tabs.find((candidate) => tabKey(candidate) === active)
  if (tab?.kind !== "doc") return
  const doc = await db.docs.get(tab.docId)
  if (doc) await printDocument(doc.content)
}

/** Reacts to the native menu (see src-tauri/src/lib.rs), which owns the tab shortcuts. */
function useMenuEvents(onOpenLink: () => void) {
  useEffect(() => {
    let unlisten: (() => void) | undefined
    let cancelled = false

    const handle = (id: string) => {
      const select = SELECT_TAB.exec(id)
      if (select) selectTabNumber(Number(select[1]))
      else if (id === "new-tab") void newDocumentTab()
      else if (id === "open-link") onOpenLink()
      else if (id === "close-tab") {
        const { active } = getTabs()
        if (active) closeTab(active)
      } else if (id === "next-tab") cycleTab(1)
      else if (id === "previous-tab") cycleTab(-1)
      else if (id === "print") printActiveDocument().catch(() => toast.error("Could not print the document"))
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
  useDeepLinks()

  useEffect(() => {
    restoreTabs()
      .catch(() => toast.error("Could not open your documents"))
      // after the restored tabs, so the linked document ends up in front
      .then(openLaunchLink)
  }, [])

  const tab = tabs.find((candidate) => tabKey(candidate) === active)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TabBar tabs={tabs} active={active} onNew={() => void newDocumentTab()} onOpenLink={openLinkDialog} />
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
