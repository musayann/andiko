// Absolute origin for canonical URLs, the sitemap and OG images. Previews and local
// builds point at production too; self-hosted forks override it with NEXT_PUBLIC_SITE_URL.
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://andiko.app").replace(/\/+$/, "")

export const siteName = "Andiko"
export const siteTitle = "Andiko · Free online Markdown editor with live preview and PDF export"
export const siteDescription =
  "A free, open-source Markdown editor with live preview, KaTeX maths, Mermaid diagrams, PDF export and share links. No sign-up: documents stay in your browser."

export const repoUrl = "https://github.com/musayann/markside"

/** Set once a document has been opened, so `/` can send returning visitors straight back to it (see src/proxy.ts). */
export const RESUME_COOKIE = "andiko_resume"

// Who runs this instance, set at build time like NEXT_PUBLIC_SITE_URL. Unset by default,
// since each deployment of this open-source app has its own operator.
const setting = (value: string | undefined) => value?.trim() || undefined

/** Where people report shared documents (and send privacy requests); no Report link without it. */
export const contactEmail = setting(process.env.NEXT_PUBLIC_CONTACT_EMAIL)

/**
 * The details the privacy policy (/privacy) has to name, or null when any is missing:
 * the policy, the terms (/terms) and the links to them are then left out rather than
 * published incomplete.
 */
export const privacyPolicy = (() => {
  const operatorName = setting(process.env.NEXT_PUBLIC_OPERATOR_NAME)
  const databaseRegion = setting(process.env.NEXT_PUBLIC_DATABASE_REGION)
  if (!operatorName || !contactEmail || !databaseRegion) return null
  return {
    operatorName,
    // a company's registered office and its entry in the companies register; optional, as
    // an individual running an instance has neither to show
    operatorAddress: setting(process.env.NEXT_PUBLIC_OPERATOR_ADDRESS),
    operatorRegistration: setting(process.env.NEXT_PUBLIC_OPERATOR_REGISTRATION),
    contactEmail,
    databaseRegion,
  }
})()
