import { useCallback, useEffect, useRef, useState } from "react"

import { db, saveDocContent, setLastDocId } from "@/lib/db"

export type SaveState = "saved" | "saving" | "unsaved"

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; initialContent: string; fileName?: string }

const SAVE_DELAY = 500

interface Backup {
  content: string
  at: number
}

// An IndexedDB write started while the page unloads may never finish, so
// unsaved text is also parked synchronously in localStorage and restored on
// the next load if it is newer than the stored document.
const backupKey = (id: string) => `andiko:unsaved:${id}`

function writeBackup(id: string, content: string) {
  try {
    localStorage.setItem(backupKey(id), JSON.stringify({ content, at: Date.now() } satisfies Backup))
  } catch {
    // storage full or unavailable
  }
}

function takeBackup(id: string): Backup | null {
  try {
    const raw = localStorage.getItem(backupKey(id))
    localStorage.removeItem(backupKey(id))
    return raw ? (JSON.parse(raw) as Backup) : null
  } catch {
    return null
  }
}

/**
 * Loads a document and autosaves edits (debounced). Pending changes are
 * flushed when the tab is hidden and when the component unmounts.
 * Mount with `key={id}` so switching documents starts from a clean state.
 */
export function useDoc(id: string) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" })
  const [content, setContentState] = useState("")
  const [saveState, setSaveState] = useState<SaveState>("saved")
  const pending = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    let cancelled = false
    db.docs.get(id).then((doc) => {
      if (cancelled) return
      if (!doc) {
        setLoad({ status: "missing" })
        return
      }
      let content = doc.content
      const backup = takeBackup(id)
      if (backup && backup.at > doc.updatedAt && backup.content !== content) {
        content = backup.content
        void saveDocContent(id, content)
      }
      setContentState(content)
      setLoad({ status: "ready", initialContent: content, fileName: doc.fileName })
      setLastDocId(id)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    const value = pending.current
    if (value === null) return
    pending.current = null
    setSaveState("saving")
    try {
      await saveDocContent(id, value)
      setSaveState(pending.current === null ? "saved" : "unsaved")
    } catch {
      pending.current ??= value
      setSaveState("unsaved")
    }
  }, [id])

  const setContent = useCallback(
    (value: string) => {
      setContentState(value)
      pending.current = value
      setSaveState("unsaved")
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, SAVE_DELAY)
    },
    [flush],
  )

  useEffect(() => {
    const onPageHide = () => {
      if (pending.current !== null) writeBackup(id, pending.current)
      void flush()
    }
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onPageHide()
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pagehide", onPageHide)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pagehide", onPageHide)
      void flush()
    }
  }, [id, flush])

  return { load, content, setContent, saveState, flush }
}
