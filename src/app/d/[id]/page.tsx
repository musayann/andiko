import { Workspace } from "@/components/workspace/workspace"

export default async function DocPage({ params }: PageProps<"/d/[id]">) {
  const { id } = await params
  // keyed so switching documents remounts the editor with fresh state
  return <Workspace key={id} id={id} />
}
