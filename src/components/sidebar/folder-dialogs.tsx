"use client"

import { useState } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`

interface NameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  submitLabel: string
  defaultName?: string
  onSubmit: (name: string) => void
}

/** Asks for a folder name, for creating and renaming. */
export function FolderNameDialog({ open, onOpenChange, ...form }: NameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* without a description, an explicit undefined tells Radix it is intentional */}
      <DialogContent {...(form.description ? {} : { "aria-describedby": undefined })}>
        {/* the form unmounts with the dialog, so every opening starts from defaultName */}
        <NameForm {...form} />
      </DialogContent>
    </Dialog>
  )
}

function NameForm({ title, description, submitLabel, defaultName = "", onSubmit }: Omit<NameDialogProps, "open" | "onOpenChange">) {
  const [name, setName] = useState(defaultName)
  const trimmed = name.trim()

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (trimmed) onSubmit(trimmed)
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="folder-name">Name</Label>
        <Input
          id="folder-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onFocus={(event) => event.target.select()}
          placeholder="Untitled folder"
          autoComplete="off"
          maxLength={120}
        />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={!trimmed}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}

export interface FolderDeletion {
  name: string
  docCount: number
  folderCount: number
  /** Published documents among them, which "Delete all" unpublishes. */
  sharedCount: number
  /** Where the contents go when only the folder is deleted, e.g. "“Work”" or "the top level". */
  destination: string
}

interface DeleteFolderDialogProps {
  target: FolderDeletion | null
  onOpenChange: (open: boolean) => void
  onConfirm: (withContents: boolean) => void
}

/** Confirms a folder deletion and lets the user keep or delete what's inside. */
export function DeleteFolderDialog({ target, onOpenChange, onConfirm }: DeleteFolderDialogProps) {
  const empty = target !== null && target.docCount === 0 && target.folderCount === 0
  const contents = target
    ? [target.docCount && plural(target.docCount, "document"), target.folderCount && plural(target.folderCount, "subfolder")]
        .filter(Boolean)
        .join(" and ")
    : ""
  const sharedNote = target?.sharedCount
    ? ` Deleting everything also takes ${plural(target.sharedCount, "published document")} offline.`
    : ""

  return (
    <AlertDialog open={target !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{target?.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {empty
              ? "This folder is empty."
              : `It contains ${contents}. Delete only the folder to move ${target && target.docCount + target.folderCount === 1 ? "it" : "them"} to ${target?.destination}, or delete everything permanently.${sharedNote}`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {empty ? (
            <AlertDialogAction variant="destructive" onClick={() => onConfirm(false)}>
              Delete
            </AlertDialogAction>
          ) : (
            <>
              <AlertDialogAction variant="outline" onClick={() => onConfirm(false)}>
                Delete folder only
              </AlertDialogAction>
              <AlertDialogAction variant="destructive" onClick={() => onConfirm(true)}>
                Delete all
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
