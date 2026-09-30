/**
 * GitHub-style slug: lowercase, drop punctuation, spaces to hyphens.
 * Unicode letters and numbers are kept so non-latin headings get useful ids.
 */
export function slugify(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
  return slug || "section"
}
