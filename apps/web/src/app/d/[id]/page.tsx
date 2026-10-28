import { isShareId, SHARE_PARAM } from "@andiko/core/share/protocol"
import { Workspace } from "@andiko/editor/workspace/workspace"
import { sharingEnabled } from "@/lib/share/store"

export default async function DocPage({ params, searchParams }: PageProps<"/d/[id]">) {
  const { id } = await params
  const sharing = sharingEnabled()
  // a malformed or unusable public id just leaves the usual "not found" page
  const share = (await searchParams)[SHARE_PARAM]
  const linkShareId = sharing && typeof share === "string" && isShareId(share) ? share : undefined
  // keyed so switching documents remounts the editor with fresh state
  return <Workspace key={id} id={id} sharing={sharing} linkShareId={linkShareId} />
}
