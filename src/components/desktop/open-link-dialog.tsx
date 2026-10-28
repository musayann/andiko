"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { parseShareInput } from "@/lib/share/public"

interface OpenLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpen: (shareId: string) => void
}

/** Opens a pasted public link (https://…/s/…) in its own tab. */
export function OpenLinkDialog({ open, onOpenChange, onOpen }: OpenLinkDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* unmounts with the dialog, so every opening starts empty */}
        <LinkForm onOpen={onOpen} />
      </DialogContent>
    </Dialog>
  )
}

function LinkForm({ onOpen }: { onOpen: (shareId: string) => void }) {
  const [value, setValue] = useState("")
  const [invalid, setInvalid] = useState(false)

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        const shareId = parseShareInput(value)
        if (shareId) onOpen(shareId)
        else setInvalid(true)
      }}
    >
      <DialogHeader>
        <DialogTitle>Open shared link</DialogTitle>
        <DialogDescription>Paste the link to a public document to read it in a new tab.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="share-link">Link</Label>
        <Input
          id="share-link"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setInvalid(false)
          }}
          placeholder="https://andiko.app/s/…"
          autoComplete="off"
          autoFocus
          aria-invalid={invalid}
        />
        {invalid && <p className="text-sm text-destructive">That doesn’t look like a link to a shared document.</p>}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={!value.trim()}>
          Open
        </Button>
      </DialogFooter>
    </form>
  )
}
