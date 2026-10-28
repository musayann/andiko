"use client"

import { useEffect } from "react"

import { docsToSync, useLiveQuery } from "@andiko/core/db"
import { cancelSync, scheduleSync, syncNow } from "@andiko/core/share/scheduler"
import { getOwnerToken } from "@andiko/core/share/token"

/**
 * Pushes local edits of published documents to their public copies. Unsynced
 * edits are tracked with the documents, so whatever doesn't make it out (offline,
 * tab closed) is pushed on the next visit. Renders nothing.
 */
export function ShareSync() {
  // changes with every save of a published document that has unsynced edits
  const pending = useLiveQuery(async () => {
    const docs = await docsToSync()
    return docs.map((doc) => `${doc.id}:${doc.updatedAt}`).join()
  }, [])

  // the owner token is created when the app opens, ahead of the first publish
  useEffect(() => {
    getOwnerToken()
  }, [])

  useEffect(() => {
    if (!pending) return
    scheduleSync()
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
