import { Workspace } from "@/components/workspace/workspace"
import { sharingEnabled } from "@/lib/share/store"

export default async function DocPage({ params }: PageProps<"/d/[id]">) {
  const { id } = await params
  // keyed so switching documents remounts the editor with fresh state
  return <Workspace key={id} id={id} sharing={sharingEnabled()} />
}
