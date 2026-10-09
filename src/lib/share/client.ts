import { toast } from "sonner"

import { clearDocShare, db, markDocSynced, needsSync, setDocShare, type Doc } from "@/lib/db"

import { MAX_SHARE_BYTES, utf8Length } from "./protocol"
import { getOwnerToken } from "./token"

// Browser side of publishing: uploads, sync of later edits, and unpublishing.

const TOO_LARGE = `This document is too large to publish (${MAX_SHARE_BYTES / 1024 / 1024} MB max).`

export const shareUrl = (shareId: string) => `${location.origin}/s/${shareId}`

let queue: Promise<unknown> = Promise.resolve()

/**
 * Runs `task` while no other tab is publishing or syncing, so each push reads
 * the latest saved content and pushes reach the server in order. The local
 * queue covers browsers without Web Locks.
 */
function withSyncLock<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(() =>
    // request() resolves to what `task` resolves to; its typing sees the promise itself
    "locks" in navigator ? (navigator.locks.request("andiko:share-sync", task) as Promise<T>) : task(),
  )
  queue = result.catch(() => undefined)
  return result
}

async function send(method: string, path: string, doc?: Pick<Doc, "title" | "content">): Promise<Response> {
  const token = getOwnerToken()
  if (!token) throw new Error("Publishing needs browser storage, which is unavailable.")
  try {
    return await fetch(path, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(doc && { "Content-Type": "application/json" }) },
      body: doc && JSON.stringify({ title: doc.title, content: doc.content }),
    })
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.")
  }
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const { error } = (await response.json()) as { error?: unknown }
    if (typeof error === "string") return error
  } catch {
    // not a JSON error body
  }
  return fallback
}

/** Uploads a document and links it to the public copy. Returns the public id. */
export function publishDoc(docId: string): Promise<string> {
  return withSyncLock(async () => {
    const doc = await db.docs.get(docId)
    if (!doc) throw new Error("Document not found")
    if (doc.shareId) return doc.shareId
    if (utf8Length(doc.content) > MAX_SHARE_BYTES) throw new Error(TOO_LARGE)

    const response = await send("POST", "/api/shares", doc)
    if (!response.ok) throw new Error(await errorMessage(response, "Could not publish the document."))
    const { id } = (await response.json()) as { id: string }
    await setDocShare(docId, id, doc.updatedAt)
    return id
  })
}

/**
 * Removes the public copies of these documents, e.g. before they are deleted.
 * Throws when the server can't be reached, so the caller can keep the documents.
 */
export function unpublishDocs(docIds: string[]): Promise<void> {
  return withSyncLock(async () => {
    for (const doc of await db.docs.bulkGet(docIds)) {
      if (!doc?.shareId) continue
      const response = await send("DELETE", `/api/shares/${doc.shareId}`)
      if (response.status === 403) {
        toast.warning(`The public link for “${doc.title}” can’t be removed from this browser`, {
          description: "It was published with an owner key this browser no longer has.",
        })
      } else if (!response.ok && response.status !== 404) {
        throw new Error(await errorMessage(response, "Could not unpublish the document."))
      }
      await clearDocShare(doc.id)
    }
  })
}

// documents already reported as too large, so typing in one doesn't repeat the toast
const tooLargeWarned = new Set<string>()

/** Pushes one document. False means "try again later" (offline or a server error). */
async function push(doc: Doc, shareId: string): Promise<boolean> {
  if (utf8Length(doc.content) > MAX_SHARE_BYTES) {
    if (!tooLargeWarned.has(doc.id)) {
      tooLargeWarned.add(doc.id)
      toast.warning(`“${doc.title}” is too large to keep its public copy in sync`, {
        description: `Published documents can be up to ${MAX_SHARE_BYTES / 1024 / 1024} MB.`,
      })
    }
    return true
  }

  let response: Response
  try {
    response = await send("PUT", `/api/shares/${shareId}`, doc)
  } catch {
    return false
  }

  if (response.ok) {
    tooLargeWarned.delete(doc.id)
    await markDocSynced(doc.id, shareId, doc.updatedAt)
    return true
  }
  if (response.status === 403 || response.status === 404) {
    await clearDocShare(doc.id)
    toast.warning(`“${doc.title}” is no longer published`, {
      description:
        response.status === 404
          ? "Its public link was removed. Share it again to get a new link."
          : "This browser can no longer update its public link. Share it again to get a new link.",
    })
    return true
  }
  // 413 can only mean a size check disagreeing with ours; retrying won't help
  return response.status === 413
}

/** Pushes every published document with unsynced edits. False when some should be retried later. */
export function syncSharedDocs(): Promise<boolean> {
  return withSyncLock(async () => {
    const docs = await db.docs.orderBy("shareId").filter(needsSync).toArray()
    for (const doc of docs) {
      if (doc.shareId && !(await push(doc, doc.shareId))) return false
    }
    return true
  })
}
