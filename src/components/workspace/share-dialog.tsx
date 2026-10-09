"use client"

import { CopyIcon, ExternalLinkIcon, LoaderCircleIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { publishDoc, shareUrl, unpublishDocs } from "@/lib/share/client"
import { cn } from "@/lib/utils"

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  docId: string
  title: string
  /** Set while the document is published. */
  shareId?: string
  /** Edits the public copy doesn't have yet. */
  pending: boolean
  /** Saves pending edits, so the first upload has them. */
  flush: () => Promise<void>
}

const copyText = (text: string) => navigator.clipboard.writeText(text).then(
  () => true,
  () => false,
)

export function ShareDialog({ open, onOpenChange, docId, title, shareId, pending, flush }: ShareDialogProps) {
  const [busy, setBusy] = useState<"publish" | "unpublish" | null>(null)
  const url = shareId ? shareUrl(shareId) : ""

  const handlePublish = async () => {
    setBusy("publish")
    try {
      await flush()
      const id = await publishDoc(docId)
      toast.success((await copyText(shareUrl(id))) ? "Published. Link copied" : "Published")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish the document.")
    } finally {
      setBusy(null)
    }
  }

  const handleUnpublish = async () => {
    setBusy("unpublish")
    try {
      await unpublishDocs([docId])
      toast.success("Stopped sharing")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not unpublish the document.")
    } finally {
      setBusy(null)
    }
  }

  const handleCopy = async () => {
    if (await copyText(url)) toast.success("Link copied")
    else toast.error("Could not copy to clipboard")
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share “{title}”</DialogTitle>
          <DialogDescription>
            {shareId
              ? "Anyone with the link can read this document. Your edits here update it automatically, and only this browser can change it."
              : "Publishing uploads this document so anyone with the link can read it. Your edits here keep the public copy up to date, and only this browser can change it. Your other documents stay in this browser."}
          </DialogDescription>
        </DialogHeader>

        {shareId && (
          <div className="grid gap-2 py-2">
            <Label htmlFor="share-url">Public link</Label>
            <div className="flex gap-2">
              <Input id="share-url" readOnly value={url} onFocus={(event) => event.target.select()} />
              <Button variant="outline" size="icon" aria-label="Copy link" onClick={() => void handleCopy()}>
                <CopyIcon />
              </Button>
              <Button variant="outline" size="icon" aria-label="Open link" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLinkIcon />
                </a>
              </Button>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
              <span className={cn("size-1.5 rounded-full", pending ? "bg-warning" : "bg-success")} />
              {pending ? "Changes waiting to sync" : "Public copy is up to date"}
            </p>
          </div>
        )}

        <DialogFooter>
          {shareId ? (
            <>
              <Button variant="destructive" onClick={() => void handleUnpublish()} disabled={busy !== null}>
                {busy === "unpublish" && <LoaderCircleIcon className="animate-spin" />}
                Stop sharing
              </Button>
              <Button onClick={() => onOpenChange(false)} disabled={busy !== null}>
                Done
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy !== null}>
                Cancel
              </Button>
              <Button onClick={() => void handlePublish()} disabled={busy !== null}>
                {busy === "publish" && <LoaderCircleIcon className="animate-spin" />}
                {busy === "publish" ? "Publishing…" : "Publish"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
