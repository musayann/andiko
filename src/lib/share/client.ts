import { toast } from "sonner"

import { clearDocShare, db, markDocSynced, needsSync, setDocShare, type Doc } from "@/lib/db"
import { contactEmail } from "@/lib/site"

import { MAX_SHARE_BYTES, sharePath, utf8Length } from "./protocol"
import { getOwnerToken } from "./token"

// Browser side of publishing: uploads, sync of later edits, and unpublishing.

const TOO_LARGE = `This document is too large to publish (${MAX_SHARE_BYTES / 1024 / 1024} MB max).`

/** The public link, with the title in it for readability (see sharePath). */
export const shareUrl = (shareId: string, title: string) => `${location.origin}${sharePath(shareId, title)}`

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
 * Warns that a public copy stays online because this browser lost the owner key it was
 * published with (403), so only the operator can remove it now. Called before the link is
 * forgotten, and stays up until dismissed, as the link is what a removal request needs.
 */
function warnStillPublic(url: string, title: string, problem: string) {
  const remedy = contactEmail
    ? `Email ${contactEmail} with its link to have it removed: ${url}`
    : `Ask whoever runs this site to remove it: ${url}`
  toast.warning(title, {
    description: `${problem} ${remedy}`,
    duration: Infinity,
    action: {
      label: "Copy link",
      onClick: () =>
        void navigator.clipboard.writeText(url).then(
          () => toast.success("Link copied"),
          () => toast.error("Could not copy to clipboard"),
        ),
    },
  })
}

/**
 * Removes the public copies of these documents, e.g. before they are deleted.
 * Resolves to false when some stay online because this browser lost their owner key
 * (the user is told how to get them removed). Throws when the server can't be reached,
 * so the caller can keep the documents.
 */
export function unpublishDocs(docIds: string[]): Promise<boolean> {
  return withSyncLock(async () => {
    let allRemoved = true
    for (const doc of await db.docs.bulkGet(docIds)) {
      if (!doc?.shareId) continue
      const response = await send("DELETE", `/api/shares/${doc.shareId}`)
      if (response.status === 403) {
        allRemoved = false
        warnStillPublic(
          shareUrl(doc.shareId, doc.title),
          `“${doc.title}” is still public`,
          "This browser no longer has the key to remove it.",
        )
      } else if (!response.ok && response.status !== 404) {
        throw new Error(await errorMessage(response, "Could not unpublish the document."))
      }
      await clearDocShare(doc.id)
    }
    return allRemoved
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
  if (response.status === 403) {
    warnStillPublic(
      shareUrl(shareId, doc.title),
      `Your edits to “${doc.title}” can’t be published`,
      "Its public link still shows an older version, and this browser no longer has the key to change or remove it.",
    )
    await clearDocShare(doc.id)
    return true
  }
  if (response.status === 404) {
    // removed on the server, e.g. after a report: don't suggest publishing it again
    await clearDocShare(doc.id)
    toast.warning(`“${doc.title}” is no longer published`, {
      description: "Its public link was removed. Your document is still in this browser.",
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
