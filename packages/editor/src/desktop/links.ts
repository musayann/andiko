import { getDoc } from "@andiko/core/db"
import { IS_DESKTOP_BUILD, openExternal } from "@andiko/core/platform"
import { docPath } from "@andiko/core/share/protocol"
import { parseAndikoLink, type AndikoLink } from "@andiko/core/share/public"
import { siteUrl } from "@andiko/core/site"
import { openDocTab, openPublicTab } from "@andiko/core/tabs"

/** Opens a link to Andiko in a tab of the desktop app, or on the website when only a browser has its document. */
export async function openAndikoLink(link: AndikoLink) {
  if (link.kind === "public") return openPublicTab(link.shareId)
  if (await getDoc(link.docId).catch(() => undefined)) openDocTab(link.docId)
  else if (link.shareId) openPublicTab(link.shareId)
  // documents live where they were written, so one from a browser opens there
  else await openExternal(`${siteUrl}${docPath(link.docId)}`)
}

/** Opens a clicked link: in the desktop app, links to Andiko open in a tab; anything else goes to the browser. */
export async function openLink(href: string) {
  const link = IS_DESKTOP_BUILD ? parseAndikoLink(href) : null
  await (link ? openAndikoLink(link) : openExternal(href))
}
