import { readFile } from "node:fs/promises"
import path from "node:path"

// Resolved from the project root; the export route lists these files in
// `outputFileTracingIncludes` so they ship with serverless deployments.
const root = process.cwd()
const fromModules = (...segments: string[]) => path.join(root, "node_modules", ...segments)

const STYLESHEETS = [
  fromModules("@fontsource-variable", "source-sans-3", "wght.css"),
  fromModules("@fontsource-variable", "source-sans-3", "wght-italic.css"),
  fromModules("@fontsource-variable", "source-code-pro", "wght.css"),
  fromModules("katex", "dist", "katex.min.css"),
  path.join(root, "src", "styles", "document.css"),
]

const WOFF2_URL = /url\(\s*['"]?([^'")]+\.woff2)['"]?\s*\)/g

/**
 * Reads a stylesheet and embeds its woff2 fonts as data: URIs (dropping
 * woff/ttf fallbacks), so headless Chrome needs no network access for fonts.
 */
async function inlineStylesheet(file: string): Promise<string> {
  const css = (await readFile(file, "utf8")).replace(/,\s*url\([^)]*\.(?:woff|ttf)\)\s*format\([^)]*\)/g, "")
  const fonts = new Map<string, string>()
  for (const [, relative] of css.matchAll(WOFF2_URL)) {
    if (fonts.has(relative)) continue
    const data = await readFile(path.join(path.dirname(file), relative))
    fonts.set(relative, `data:font/woff2;base64,${data.toString("base64")}`)
  }
  return css.replace(WOFF2_URL, (_, relative: string) => `url(${fonts.get(relative)})`)
}

let cachedStyles: Promise<string> | null = null

function loadStyles(): Promise<string> {
  const load = async () => (await Promise.all(STYLESHEETS.map(inlineStylesheet))).join("\n")
  // re-read in development so edits to document.css show up in exports
  if (process.env.NODE_ENV !== "production") return load()
  cachedStyles ??= load().catch((error) => {
    cachedStyles = null
    throw error
  })
  return cachedStyles
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

/** A standalone HTML page for the PDF renderer. `bodyHtml` is untrusted. */
export async function buildPdfHtml(bodyHtml: string, title: string): Promise<string> {
  const styles = await loadStyles()
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src data:">
<title>${escapeHtml(title)}</title>
<style>
${styles}
html, body { margin: 0; padding: 0; background: #fff; }
</style>
</head>
<body>
<article class="markdown-body">${bodyHtml}</article>
</body>
</html>`
}
