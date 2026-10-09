import type { MetadataRoute } from "next"

import { siteUrl } from "@/lib/site"

// Documents live in each visitor's browser, so the landing page is the only public URL.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteUrl, changeFrequency: "monthly", priority: 1 }]
}
