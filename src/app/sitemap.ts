import type { MetadataRoute } from "next"

import { privacyPolicy, siteUrl } from "@/lib/site"

// Documents live in each visitor's browser and shared ones are kept out of search results,
// so only the landing page and the legal pages (when this instance publishes them) are listed.
export default function sitemap(): MetadataRoute.Sitemap {
  const legalPages = privacyPolicy ? ["/privacy", "/terms"] : []
  return [
    { url: siteUrl, changeFrequency: "monthly", priority: 1 },
    ...legalPages.map((path) => ({ url: `${siteUrl}${path}`, changeFrequency: "yearly" as const, priority: 0.3 })),
  ]
}
