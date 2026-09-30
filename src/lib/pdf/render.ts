import { getBrowser } from "./browser"
import { buildPdfHtml } from "./template"
import { isAllowedUrl } from "./url-guard"

export interface PdfRequest {
  html: string
  title: string
  paper: "a4" | "letter"
  pageNumbers: boolean
}

const FOOTER = `<div style="width:100%;padding:0 16mm;font:9px 'Helvetica Neue',Arial,sans-serif;color:#999;text-align:center">
<span class="pageNumber"></span> / <span class="totalPages"></span></div>`

export async function renderPdf({ html, title, paper, pageNumbers }: PdfRequest): Promise<Uint8Array> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    // content arrives pre-rendered; nothing on the page needs to run
    await page.setJavaScriptEnabled(false)
    await page.setRequestInterception(true)
    page.on("request", (request) => {
      isAllowedUrl(request.url()).then(
        (allowed) => (allowed ? request.continue() : request.abort("blockedbyclient")),
        () => request.abort("blockedbyclient"),
      )
    })

    await page.setContent(await buildPdfHtml(html, title), { waitUntil: "load", timeout: 30_000 })
    // remote images may still be arriving; fonts are inlined
    await page.waitForNetworkIdle({ idleTime: 250, timeout: 15_000 }).catch(() => undefined)

    return await page.pdf({
      format: paper === "letter" ? "Letter" : "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: pageNumbers ? "20mm" : "18mm", left: "16mm", right: "16mm" },
      displayHeaderFooter: pageNumbers,
      headerTemplate: "<span></span>",
      footerTemplate: pageNumbers ? FOOTER : "<span></span>",
      timeout: 30_000,
    })
  } finally {
    await page.close().catch(() => undefined)
  }
}
