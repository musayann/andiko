import { useLiveQuery } from "dexie-react-hooks"
import { useSyncExternalStore } from "react"

import { db, needsSync } from "@/lib/db"
import { isSyncFailing, subscribeSyncFailing } from "@/lib/share/scheduler"

/** "failing": the public copy is behind and the last push didn't get through; it keeps retrying. */
export type ShareSyncState = "synced" | "syncing" | "failing"

export interface ShareStatus {
  /** Set while the document is published. */
  shareId?: string
  sync: ShareSyncState
}

/** Whether a document is published, and whether its public copy has the latest saved edits. */
export function useShareStatus(docId: string): ShareStatus {
  const doc = useLiveQuery(async () => {
    const doc = await db.docs.get(docId)
    return { shareId: doc?.shareId, pending: doc !== undefined && needsSync(doc) }
  }, [docId])
  const failing = useSyncExternalStore(subscribeSyncFailing, isSyncFailing, () => false)
  return { shareId: doc?.shareId, sync: !doc?.pending ? "synced" : failing ? "failing" : "syncing" }
}
