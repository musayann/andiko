import { db, type PublicCopy } from "../db"
import { API_BASE, APP_SCHEME } from "../platform"
import { siteUrl } from "../site"
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

/** The path segments of a link; `andiko://s/…` puts the first one in the host. */
function pathSegments(url: URL): string[] {
  const path = url.protocol === `${APP_SCHEME}:` ? `${url.host}/${url.pathname}` : url.pathname
  return path.split("/").filter(Boolean)
}

/** The public id in what someone pasted: a /s/ link, a `<slug>-<id>` segment, or a bare id. */
export function parseShareInput(input: string): string | null {
  const text = input.trim()
  if (!text) return null
  let segment = text
  try {
    const url = new URL(text)
    const parts = pathSegments(url)
    // the editor's own links name the public copy in ?share=
    const param = url.searchParams.get(SHARE_PARAM)
    if (param && isShareId(param)) return param
    segment = parts[0] === "s" ? (parts[1] ?? "") : ""
  } catch {
    // not a URL: treat it as the id or slug itself
  }
  return shareIdFromSegment(segment)
}

/** What a link to Andiko opens in the desktop app: a public document, or a document in the editor (and its public copy, if published). */
export type AndikoLink = { kind: "public"; shareId: string } | { kind: "doc"; docId: string; shareId?: string }

const DOC_ID = /^[\w-]+$/
const bareHost = (host: string) => host.replace(/^www\./, "")

/** The document a link to this instance's site, or in the app's `andiko://` scheme, points at; null for any other link. */
export function parseAndikoLink(href: string): AndikoLink | null {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }
  const onSite = (url.protocol === "https:" || url.protocol === "http:") && bareHost(url.host) === bareHost(new URL(siteUrl).host)
  if (!onSite && url.protocol !== `${APP_SCHEME}:`) return null

  const [section, segment, ...rest] = pathSegments(url)
  if (!segment || rest.length > 0) return null
  if (section === "s") {
    const shareId = shareIdFromSegment(segment)
    return shareId ? { kind: "public", shareId } : null
  }
  if (section === "d" && DOC_ID.test(segment)) {
    const shareId = url.searchParams.get(SHARE_PARAM)
    return { kind: "doc", docId: segment, ...(shareId && isShareId(shareId) && { shareId }) }
  }
  return null
}
