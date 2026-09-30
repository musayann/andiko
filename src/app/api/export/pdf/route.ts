import { renderPdf, type PdfRequest } from "@/lib/pdf/render"
import { toFileName } from "@/lib/title"

export const maxDuration = 60

const MAX_BODY_BYTES = 5 * 1024 * 1024

function parseRequest(body: unknown): PdfRequest | null {
  if (!body || typeof body !== "object") return null
  const { html, title, paper, pageNumbers } = body as Record<string, unknown>
  if (typeof html !== "string") return null
  return {
    html,
    title: typeof title === "string" && title.trim() ? title.slice(0, 200) : "Untitled",
    paper: paper === "letter" ? "letter" : "a4",
    pageNumbers: pageNumbers !== false,
  }
}

const error = (message: string, status: number) => Response.json({ error: message }, { status })

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return error("The document is too large to export (5 MB max).", 413)
  }

  let payload: PdfRequest | null
  try {
    const text = await request.text()
    if (text.length > MAX_BODY_BYTES) return error("The document is too large to export (5 MB max).", 413)
    payload = parseRequest(JSON.parse(text))
  } catch {
    payload = null
  }
  if (!payload) return error("Invalid export request.", 400)

  let pdf: Uint8Array
  try {
    pdf = await renderPdf(payload)
  } catch (cause) {
    console.error("PDF export failed", cause)
    return error("The server could not render the PDF.", 500)
  }

  const fileName = `${toFileName(payload.title)}.pdf`
  return new Response(new Blob([pdf as Uint8Array<ArrayBuffer>], { type: "application/pdf" }), {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  })
}
