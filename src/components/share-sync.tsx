"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { useEffect } from "react"

import { db, needsSync } from "@/lib/db"
import { syncSharedDocs } from "@/lib/share/client"
import { getOwnerToken } from "@/lib/share/token"

const SYNC_DELAY = 2000
const RETRY_DELAY = 30_000

let timer: ReturnType<typeof setTimeout> | undefined

/** Syncs after `delay` unless a sync is already due: a throttle, so a long typing session still syncs. */
function scheduleSync(delay: number) {
  if (timer !== undefined) return
  timer = setTimeout(async () => {
    // cleared before the push so saves made during it schedule the next one
    timer = undefined
    if (!(await syncSharedDocs().catch(() => false))) scheduleSync(RETRY_DELAY)
  }, delay)
}

function cancelSync() {
  clearTimeout(timer)
  timer = undefined
}

function syncNow() {
  cancelSync()
  scheduleSync(0)
}

/**
 * Pushes local edits of published documents to their public copies. Unsynced
 * edits are tracked in IndexedDB, so whatever doesn't make it out (offline, tab
 * closed) is pushed on the next visit. Renders nothing.
 */
export function ShareSync() {
  // changes with every save of a published document that has unsynced edits
  const pending = useLiveQuery(async () => {
    const docs = await db.docs.orderBy("shareId").filter(needsSync).toArray()
    return docs.map((doc) => `${doc.id}:${doc.updatedAt}`).join()
  }, [])

  // the owner token is created when the app opens, ahead of the first publish
  useEffect(() => {
    getOwnerToken()
  }, [])

  useEffect(() => {
    if (!pending) return
    scheduleSync(SYNC_DELAY)
    const onVisibility = () => {
      if (document.visibilityState === "hidden") syncNow()
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("online", syncNow)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("online", syncNow)
    }
  }, [pending])

  useEffect(() => cancelSync, [])

  return null
}
