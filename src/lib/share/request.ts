import { createHash } from "node:crypto"

import { MAX_SHARE_BYTES, MAX_TITLE_LENGTH, TOKEN_PATTERN, utf8Length } from "./protocol"
import type { ShareBody } from "./store"

// Request parsing for the /api/shares routes (server only).

// JSON escaping (newlines, quotes) can roughly double the size of Markdown
const MAX_REQUEST_BYTES = MAX_SHARE_BYTES * 2

const TOO_LARGE = `The document is too large to publish (${MAX_SHARE_BYTES / 1024 / 1024} MB max).`

export const error = (message: string, status: number) => Response.json({ error: message }, { status })

/** SHA-256 of the `Authorization: Bearer` owner token, or null when it is missing or malformed. */
export function ownerHash(request: Request): string | null {
  const token = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "")?.[1]
  if (!token || !TOKEN_PATTERN.test(token)) return null
  return createHash("sha256").update(token).digest("hex")
}

function parseBody(body: unknown): ShareBody | null {
  if (!body || typeof body !== "object") return null
  const { title, content } = body as Record<string, unknown>
  if (typeof content !== "string") return null
  return {
    title: typeof title === "string" && title.trim() ? title.trim().slice(0, MAX_TITLE_LENGTH) : "Untitled",
    content,
  }
}

/** The `{ title, content }` body, or the error response to send instead. */
export async function readShareBody(request: Request): Promise<ShareBody | Response> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) return error(TOO_LARGE, 413)

  let body: ShareBody | null
  try {
    const text = await request.text()
    if (text.length > MAX_REQUEST_BYTES) return error(TOO_LARGE, 413)
    body = parseBody(JSON.parse(text))
  } catch {
    body = null
  }
  if (!body) return error("Invalid request.", 400)
  if (utf8Length(body.content) > MAX_SHARE_BYTES) return error(TOO_LARGE, 413)
  return body
}
