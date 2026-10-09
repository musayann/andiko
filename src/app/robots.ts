import type { MetadataRoute } from "next"

import { siteUrl } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /d/ stays crawlable so bots can read its noindex tag
      disallow: "/api/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
