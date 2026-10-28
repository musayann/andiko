"use client"

import { CloudOffIcon, FileQuestionIcon, LoaderCircleIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { loadPublicCopy, type PublicLoad } from "@andiko/core/share/public"
import { closeTab } from "@andiko/core/tabs"
import { Button } from "@andiko/ui/components/button"

import { SharedDocument } from "../shared/shared-document"

/** A public document in a tab: fetched from the server, or the saved copy when offline. */
export function PublicTab({ shareId }: { shareId: string }) {
  const [result, setResult] = useState<PublicLoad | null>(null)
  // bumped to fetch again
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let stale = false
    void loadPublicCopy(shareId).then((loaded) => {
      if (!stale) setResult(loaded)
    })
    return () => {
      stale = true
    }
  }, [shareId, attempt])

  const retry = () => {
    setResult(null)
    setAttempt((n) => n + 1)
  }

  // a saved copy is refreshed as soon as the connection is back
  const offline = result?.status === "ok" && result.offline
  useEffect(() => {
    if (!offline) return
    const refresh = () => setAttempt((n) => n + 1)
    window.addEventListener("online", refresh)
    return () => window.removeEventListener("online", refresh)
  }, [offline])

  if (!result) {
    return (
      <div className="grid h-full place-items-center text-muted-foreground">
        <LoaderCircleIcon className="size-5 animate-spin" aria-label="Loading" />
      </div>
    )
  }

  if (result.status !== "ok") {
    const missing = result.status === "missing"
    const Icon = missing ? FileQuestionIcon : CloudOffIcon
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <Icon className="size-10 text-muted-foreground" />
        <h1 className="text-lg font-medium">{missing ? "Document not found" : "Can’t reach the server"}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {missing
            ? "This document is no longer published."
            : "Public documents are read from the server the first time. Check your connection and try again."}
        </p>
        <div className="flex gap-2">
          {!missing && (
            <Button variant="outline" onClick={retry}>
              Try again
            </Button>
          )}
          <Button variant="outline" onClick={() => closeTab(`public:${shareId}`)}>
            Close tab
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {result.offline && (
        <div className="flex items-center gap-2 border-b bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          <CloudOffIcon className="size-3.5" aria-hidden />
          Offline: showing the copy saved {new Date(result.copy.fetchedAt).toLocaleString()}.
        </div>
      )}
      <div className="min-h-0 flex-1">
        {/* keyed so a refreshed copy re-renders from scratch */}
        <SharedDocument
          key={result.copy.updatedAt}
          id={result.copy.id}
          title={result.copy.title}
          content={result.copy.content}
        />
      </div>
    </div>
  )
}
