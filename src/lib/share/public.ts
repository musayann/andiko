import { db, type PublicCopy } from "@/lib/db"
import { API_BASE } from "@/lib/platform"

import { isShareId, SHARE_PARAM, shareIdFromSegment } from "./protocol"

// The desktop app reads public documents through GET /api/shares/{id} and keeps the
// last copy it saw, so a tab opened once still works offline.

export type PublicLoad =
  | { status: "ok"; copy: PublicCopy; /** True when the server couldn't be reached and this is the saved copy. */ offline: boolean }
  | { status: "missing" }
  | { status: "unavailable" }

export async function loadPublicCopy(shareId: string): Promise<PublicLoad> {
  const cached = await db.publicCopies.get(shareId).catch(() => undefined)
  try {
    const response = await fetch(`${API_BASE}/api/shares/${shareId}`)
    if (response.status === 404) {
      await db.publicCopies.delete(shareId).catch(() => undefined)
      return { status: "missing" }
    }
    if (!response.ok) throw new Error(String(response.status))
    const body = (await response.json()) as Pick<PublicCopy, "id" | "title" | "content" | "updatedAt">
    const copy: PublicCopy = { ...body, fetchedAt: Date.now() }
    await db.publicCopies.put(copy).catch(() => undefined)
    return { status: "ok", copy, offline: false }
  } catch {
    return cached ? { status: "ok", copy: cached, offline: true } : { status: "unavailable" }
  }
}

/** The public id in what someone pasted: a /s/ link, a `<slug>-<id>` segment, or a bare id. */
export function parseShareInput(input: string): string | null {
  const text = input.trim()
  if (!text) return null
  let segment = text
  try {
    const url = new URL(text)
    const parts = url.pathname.split("/").filter(Boolean)
    // the editor's own links name the public copy in ?share=
    const param = url.searchParams.get(SHARE_PARAM)
    if (param && isShareId(param)) return param
    segment = parts[0] === "s" ? (parts[1] ?? "") : ""
  } catch {
    // not a URL: treat it as the id or slug itself
  }
  return shareIdFromSegment(segment)
}
