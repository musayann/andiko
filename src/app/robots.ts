import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /d/ stays crawlable so bots can read its noindex tag
      disallow: "/api/",
    },
  }
}
