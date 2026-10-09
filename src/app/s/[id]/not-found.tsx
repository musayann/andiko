import { LinkIcon } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function SharedDocumentNotFound() {
  return (
    <div className="flex h-svh flex-col items-center justify-center gap-3 p-8 text-center">
      <LinkIcon className="size-10 text-muted-foreground" />
      <h1 className="text-lg font-medium">Document not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This link doesn’t exist, or its owner stopped sharing the document.
      </p>
      <Button asChild variant="outline">
        <Link href="/">Go to Andiko</Link>
      </Button>
    </div>
  )
}
