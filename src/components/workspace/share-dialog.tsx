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
import type { ShareSyncState } from "@/hooks/use-share-status"
import { publishDoc, shareUrl, unpublishDocs } from "@/lib/share/client"
import { privacyPolicy } from "@/lib/site"
import { cn } from "@/lib/utils"

const SYNC_STATES: Record<ShareSyncState, { description: string; dot: string }> = {
  synced: { description: "The public copy is up to date.", dot: "bg-success" },
  syncing: { description: "Updating the public copy…", dot: "bg-warning animate-pulse" },
  failing: { description: "Couldn’t reach the server. Your edits will sync once it’s back.", dot: "bg-destructive" },
}

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  docId: string
  title: string
  /** Set while the document is published. */
  shareId?: string
  /** Sync state of the public copy, while published. */
  sync: ShareSyncState
  /** Saves pending edits, so the first upload has them. */
  flush: () => Promise<void>
}

const copyText = (text: string) => navigator.clipboard.writeText(text).then(
  () => true,
  () => false,
)

const POLICY_LINK = "underline underline-offset-2 hover:text-foreground"

export function ShareDialog({
  open,
  onOpenChange,
  docId,
  title,
  shareId: currentShareId,
  sync,
  flush,
}: ShareDialogProps) {
  const [busy, setBusy] = useState<"publish" | "unpublish" | null>(null)
  // The view follows the document's share while the dialog is open and idle, and holds still
  // otherwise, so closing after "Stop sharing" doesn't flash the Publish view as it fades out
  const [shareId, setShareId] = useState(currentShareId)
  if (open && busy === null && shareId !== currentShareId) setShareId(currentShareId)
  const url = shareId ? shareUrl(shareId, title) : ""

  const handlePublish = async () => {
    setBusy("publish")
    try {
      await flush()
      const id = await publishDoc(docId)
      toast.success((await copyText(shareUrl(id, title))) ? "Published. Link copied" : "Published")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish the document.")
    } finally {
      setBusy(null)
    }
  }

  const handleUnpublish = async () => {
    setBusy("unpublish")
    try {
      // false when the link stays online; unpublishDocs has already said why
      if (await unpublishDocs([docId])) toast.success("Stopped sharing")
      // either way the document is no longer shared from here, so there's nothing left to show
      onOpenChange(false)
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
              ? "Anyone with the link can read this document. Your edits here update it automatically, and only this browser can edit it or stop sharing it."
              : "Publishing uploads this document so anyone with the link can read it. Your edits here keep the public copy up to date, and only this browser can edit it or stop sharing it. Your other documents aren’t published."}
            {privacyPolicy && (
              <>
                {/* agreement is tied to the Publish click; the privacy policy is a notice, linked from the sidebar */}
                {shareId ? " By sharing, you agreed to the " : " By publishing, you agree to the "}
                <a href="/terms" target="_blank" rel="noopener" className={POLICY_LINK}>
                  terms of use
                </a>
                .
              </>
            )}
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
              <span className={cn("size-1.5 shrink-0 rounded-full", SYNC_STATES[sync].dot)} />
              {SYNC_STATES[sync].description}
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
