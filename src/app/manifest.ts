import type { MetadataRoute } from "next"

import { siteDescription, siteName } from "@/lib/site"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteName} Markdown editor`,
    short_name: siteName,
    description: siteDescription,
    // installed app opens the editor, not the landing page
    start_url: "/d",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#171717",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  }
}
