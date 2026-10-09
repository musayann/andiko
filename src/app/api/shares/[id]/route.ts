import { isShareId } from "@/lib/share/protocol"
import { error, ownerHash, readShareBody } from "@/lib/share/request"
import { deleteShare, sharingEnabled, updateShare, type WriteResult } from "@/lib/share/store"

/** The owner hash for a write to `id`, or the error response to send instead. */
function authorize(request: Request, id: string): string | Response {
  if (!sharingEnabled()) return error("Publishing is not configured on this server.", 503)
  if (!isShareId(id)) return error("This document is not published.", 404)
  return ownerHash(request) ?? error("Missing or invalid owner token.", 401)
}

function respond(result: WriteResult) {
  if (result === "forbidden") return error("Only the browser that published this document can change it.", 403)
  if (result === "missing") return error("This document is not published.", 404)
  return new Response(null, { status: 204 })
}

/** Replaces the published copy with the owner's latest version. */
export async function PUT(request: Request, ctx: RouteContext<"/api/shares/[id]">) {
  const { id } = await ctx.params
  const owner = authorize(request, id)
  if (owner instanceof Response) return owner

  const body = await readShareBody(request)
  if (body instanceof Response) return body
  return respond(await updateShare(id, owner, body))
}

/** Unpublishes: the public link stops working. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/shares/[id]">) {
  const { id } = await ctx.params
  const owner = authorize(request, id)
  if (owner instanceof Response) return owner
  return respond(await deleteShare(id, owner))
}
