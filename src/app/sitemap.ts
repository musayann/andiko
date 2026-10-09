import type { MetadataRoute } from "next"

import { privacyPolicy, siteUrl } from "@/lib/site"

// Documents live in each visitor's browser and shared ones are kept out of search results,
// so only the landing page and the privacy policy (when this instance publishes one) are listed.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: "monthly", priority: 1 },
    ...(privacyPolicy ? [{ url: `${siteUrl}/privacy`, changeFrequency: "yearly" as const, priority: 0.3 }] : []),
  ]
}
