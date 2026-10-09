// Absolute origin for canonical URLs, the sitemap and OG images. Previews and local
// builds point at production too; self-hosted forks override it with NEXT_PUBLIC_SITE_URL.
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://andiko.app").replace(/\/+$/, "")

export const siteName = "Andiko"
export const siteTitle = "Andiko · Free online Markdown editor with live preview and PDF export"
export const siteDescription =
  "A free, open-source Markdown editor with live preview, KaTeX maths, Mermaid diagrams and PDF export. No sign-up: your documents stay in your browser."

export const repoUrl = "https://github.com/musayann/markside"

/** Set once a document has been opened, so `/` can send returning visitors straight back to it (see src/proxy.ts). */
export const RESUME_COOKIE = "andiko_resume"
