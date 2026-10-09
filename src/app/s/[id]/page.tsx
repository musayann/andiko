import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { cache } from "react"

import { SharedDocument } from "@/components/shared/shared-document"
import { isShareId } from "@/lib/share/protocol"
import { getShare, sharingEnabled } from "@/lib/share/store"
import { siteName } from "@/lib/site"

const DESCRIPTION = `A Markdown document shared with ${siteName}.`
const OG_IMAGE = "/opengraph-image"

// one query per request, shared by generateMetadata and the page
const loadShare = cache(async (id: string) => (sharingEnabled() && isShareId(id) ? getShare(id) : null))

export async function generateMetadata({ params }: PageProps<"/s/[id]">): Promise<Metadata> {
  const { id } = await params
  const share = await loadShare(id)
  if (!share) return { title: "Document not found", robots: { index: false, follow: false } }
  // openGraph and twitter replace the root layout's, so its image is named again
  return {
    title: share.title,
    description: DESCRIPTION,
    // anyone can publish anything, so shared documents stay out of search results
    robots: { index: false, follow: false },
    openGraph: { type: "article", siteName, url: `/s/${id}`, title: share.title, description: DESCRIPTION, images: OG_IMAGE },
    twitter: { card: "summary_large_image", title: share.title, description: DESCRIPTION, images: OG_IMAGE },
  }
}

/** A published document, read-only. Always rendered per request, so visitors see the latest version. */
export default async function SharedPage({ params }: PageProps<"/s/[id]">) {
  await connection()
  const { id } = await params
  const share = await loadShare(id)
  if (!share) notFound()
  return <SharedDocument id={share.id} title={share.title} content={share.content} />
}
