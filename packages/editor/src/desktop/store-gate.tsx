"use client"

import { LoaderCircleIcon } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

import { openStore } from "@andiko/core/db"

/**
 * Shows the app once its documents are read in from the database (see
 * packages/core/src/store/sqlite.ts), so the tabs and the owner token, which are
 * read right away, come from there too.
 */
export function StoreGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<
    { status: "opening" } | { status: "open" } | { status: "failed"; message: string }
  >({ status: "opening" })

  useEffect(() => {
    openStore().then(
      () => setState({ status: "open" }),
      (error: unknown) =>
        setState({ status: "failed", message: error instanceof Error ? error.message : String(error) }),
    )
  }, [])

  if (state.status === "open") return children
  return (
    <div data-tauri-drag-region className="grid h-svh place-items-center p-6 text-center text-muted-foreground">
      {state.status === "opening" ? (
        <LoaderCircleIcon className="size-5 animate-spin" aria-label="Loading" />
      ) : (
        <div className="max-w-sm space-y-1">
          <p className="font-medium text-foreground">Could not open your documents</p>
          <p className="text-sm">{state.message}</p>
        </div>
      )}
    </div>
  )
}
