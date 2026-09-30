const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)\s*(?:\r?\n|$)/
const FRONT_MATTER_TITLE = /^title:\s*(["']?)(.+?)\1\s*$/m
const FENCE = /^\s*(```|~~~)/

/**
 * Document title: front-matter `title`, else the first H1,
 * else "Untitled". Cheap line scan so it can run on every save.
 */
export function getDocTitle(content: string): string {
  const frontMatter = FRONT_MATTER.exec(content)
  if (frontMatter) {
    const title = FRONT_MATTER_TITLE.exec(frontMatter[1])
    if (title) return title[2].trim()
  }

  const body = frontMatter ? content.slice(frontMatter[0].length) : content
  let inFence = false
  for (const line of body.split("\n")) {
    if (FENCE.test(line)) inFence = !inFence
    if (inFence) continue
    const heading = /^#\s+(.+?)\s*#*\s*$/.exec(line)
    if (heading) return heading[1].replace(/[*_`~=]/g, "").trim() || "Untitled"
  }
  return "Untitled"
}

/** File-system friendly name for downloads. */
export function toFileName(title: string): string {
  const name = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
  return name || "untitled"
}
