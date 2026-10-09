import { error, ownerHash, readShareBody } from "@/lib/share/request"
import { createShare, MAX_SHARES_PER_OWNER, sharingEnabled } from "@/lib/share/store"

/** Publishes a document. The owner token's hash becomes the only key that can change or remove it. */
export async function POST(request: Request) {
  if (!sharingEnabled()) return error("Publishing is not configured on this server.", 503)
  const owner = ownerHash(request)
  if (!owner) return error("Missing or invalid owner token.", 401)

  const body = await readShareBody(request)
  if (body instanceof Response) return body

  const id = await createShare(owner, body)
  if (!id) return error(`You can publish up to ${MAX_SHARES_PER_OWNER} documents.`, 429)
  return Response.json({ id }, { status: 201 })
}
