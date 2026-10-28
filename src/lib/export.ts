import { toast } from "sonner"

import { API_BASE, isTauri } from "./platform"
import { renderMarkdown } from "./markdown/renderer"
import { sanitizeHtml } from "./markdown/sanitize"
import { buildStaticHtml } from "./preview-dom"
import { toFileName } from "./title"

export type PaperSize = "a4" | "letter"

export interface PdfOptions {
  paper: PaperSize
  pageNumbers: boolean
}

/** The desktop app asks where to save, as a webview can't download to a folder by itself. */
async function saveWithDialog(blob: Blob, fileName: string) {
  const [{ save }, { writeFile }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/plugin-fs"),
  ])
  const extension = fileName.split(".").pop() ?? ""
  const path = await save({
    defaultPath: fileName,
    filters: extension ? [{ name: extension.toUpperCase(), extensions: [extension] }] : [],
  })
  if (path) await writeFile(path, new Uint8Array(await blob.arrayBuffer()))
}

async function saveBlob(blob: Blob, fileName: string) {
  if (isTauri()) {
    try {
      await saveWithDialog(blob, fileName)
    } catch {
      toast.error(`Could not save ${fileName}`)
    }
    return
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** The document as static HTML (light diagrams, spoilers open), ready for print/PDF. */
export async function renderStaticDocument(content: string): Promise<string> {
  return buildStaticHtml(sanitizeHtml(renderMarkdown(content).html))
}

export function downloadMarkdown(content: string, title: string) {
  return saveBlob(new Blob([content], { type: "text/markdown;charset=utf-8" }), `${toFileName(title)}.md`)
}

export function downloadZip(data: Uint8Array<ArrayBuffer>, name: string) {
  return saveBlob(new Blob([data], { type: "application/zip" }), `${name}.zip`)
}

export async function downloadPdf(content: string, title: string, options: PdfOptions) {
  // the desktop app works offline: the system print dialog saves a PDF; the server renders it if that fails
  if (isTauri()) {
    try {
      await printDocument(content)
      return
    } catch {
      // fall through to the server
    }
  }
  const html = await renderStaticDocument(content)
  const response = await fetch(`${API_BASE}/api/export/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, title, ...options }),
  })
  if (!response.ok) {
    let message = `PDF export failed (${response.status})`
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // non-JSON error body
    }
    throw new Error(message)
  }
  await saveBlob(await response.blob(), `${toFileName(title)}.pdf`)
}

function waitForImages(root: HTMLElement, timeout = 5000) {
  const pending = Array.from(root.querySelectorAll("img"))
    .filter((img) => !img.complete)
    .map(
      (img) =>
        new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true })
          img.addEventListener("error", () => resolve(), { once: true })
        }),
    )
  return Promise.race([Promise.all(pending), new Promise((resolve) => setTimeout(resolve, timeout))])
}

/** Browser print fallback: prints a static copy of the document via #print-root. */
export async function printDocument(content: string) {
  const html = await renderStaticDocument(content)
  let root = document.getElementById("print-root")
  if (!root) {
    root = document.createElement("div")
    root.id = "print-root"
    document.body.append(root)
  }
  root.innerHTML = `<article class="markdown-body">${html}</article>`
  await Promise.all([waitForImages(root), document.fonts.ready])

  const cleanup = () => {
    root.innerHTML = ""
    window.removeEventListener("afterprint", cleanup)
  }
  window.addEventListener("afterprint", cleanup)
  if (isTauri()) {
    // WKWebView ignores window.print(); the shell opens the native print dialog instead
    const { invoke } = await import("@tauri-apps/api/core")
    await invoke("print_page")
  } else {
    window.print()
  }
}
