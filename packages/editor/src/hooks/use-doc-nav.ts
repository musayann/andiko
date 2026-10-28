"use client"

import { useParams, useRouter } from "next/navigation"
import { useMemo } from "react"

import { IS_DESKTOP_BUILD } from "@andiko/core/platform"
import { closeDocTabs, getTabs, openDocTab, useTabs } from "@andiko/core/tabs"

export interface DocNav {
  /** The document being edited right now, if any. */
  activeId: string | undefined
  open: (docId: string) => void
  /**
   * Leaves documents that were just deleted. Resolves `fallback` (a document id)
   * only when nothing else is left open to land on.
   */
  leave: (deletedIds: string[], fallback: () => Promise<string>) => Promise<void>
}

/**
 * Where documents open: the route on the website, tabs in the desktop app.
 * Both sources are always read (hooks can't be conditional); the build picks one.
 */
export function useDocNav(): DocNav {
  const router = useRouter()
  const params = useParams<{ id?: string }>()
  const { tabs, active } = useTabs()

  const activeTab = tabs.find((tab) => (tab.kind === "doc" ? `doc:${tab.docId}` : `public:${tab.shareId}`) === active)
  const activeId = IS_DESKTOP_BUILD ? (activeTab?.kind === "doc" ? activeTab.docId : undefined) : params.id

  return useMemo<DocNav>(
    () => ({
      activeId,
      open: (docId) => (IS_DESKTOP_BUILD ? openDocTab(docId) : router.push(`/d/${docId}`)),
      leave: async (deletedIds, fallback) => {
        if (IS_DESKTOP_BUILD) {
          closeDocTabs(deletedIds)
          if (getTabs().tabs.length === 0) openDocTab(await fallback())
        } else if (activeId && deletedIds.includes(activeId)) {
          router.replace(`/d/${await fallback()}`)
        }
      },
    }),
    [activeId, router],
  )
}
