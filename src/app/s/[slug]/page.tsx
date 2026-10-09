import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { connection } from "next/server"
import { cache } from "react"

import { SharedDocument } from "@/components/shared/shared-document"
import { shareIdFromSegment, sharePath } from "@/lib/share/protocol"
import { getShare, sharingEnabled } from "@/lib/share/store"
import { siteName } from "@/lib/site"

const DESCRIPTION = `A Markdown document shared with ${siteName}.`
const OG_IMAGE = "/opengraph-image"

// `slug` is the whole segment, `<title-slug>-<id>` (or a bare id); only the id is looked up.
// One query per request, shared by generateMetadata and the page.
const loadShare = cache(async (slug: string) => {
  const id = shareIdFromSegment(slug)
  return sharingEnabled() && id ? getShare(id) : null
})

export async function generateMetadata({ params }: PageProps<"/s/[slug]">): Promise<Metadata> {
  const share = await loadShare((await params).slug)
  if (!share) return { title: "Document not found", robots: { index: false, follow: false } }
  const url = sharePath(share.id, share.title)
  // openGraph and twitter replace the root layout's, so its image is named again
  return {
    title: share.title,
    description: DESCRIPTION,
    // anyone can publish anything, so shared documents stay out of search results
    robots: { index: false, follow: false },
    openGraph: { type: "article", siteName, url, title: share.title, description: DESCRIPTION, images: OG_IMAGE },
    twitter: { card: "summary_large_image", title: share.title, description: DESCRIPTION, images: OG_IMAGE },
  }
}

/** A published document, read-only. Always rendered per request, so visitors see the latest version. */
export default async function SharedPage({ params }: PageProps<"/s/[slug]">) {
  await connection()
  const { slug } = await params
  const share = await loadShare(slug)
  if (!share) notFound()
  // links made before a title change, or without a slug, move to the current title's URL
  const path = sharePath(share.id, share.title)
  if (`/s/${slug}` !== path) redirect(path)
  return <SharedDocument id={share.id} title={share.title} content={share.content} />
}
