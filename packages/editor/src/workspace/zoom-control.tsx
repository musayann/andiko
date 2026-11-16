"use client"

import { MinusIcon, PlusIcon } from "lucide-react"
import type { ReactNode } from "react"

import { IS_DESKTOP_BUILD } from "@andiko/core/platform"
import { resetPreviewZoom, usePreviewZoom, ZOOM_STEPS, zoomPreviewIn, zoomPreviewOut } from "@andiko/core/preview-zoom"
import { Button } from "@andiko/ui/components/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@andiko/ui/components/tooltip"
import { cn } from "@andiko/ui/lib/utils"

const ITEM = "h-6 min-w-6 rounded-md px-1 text-muted-foreground hover:bg-background/60 hover:text-foreground"

function ZoomButton({
  label,
  "aria-label": ariaLabel = label,
  shortcut,
  className,
  ...props
}: {
  /** The tooltip, and the accessible name unless `aria-label` is given. */
  label: string
  "aria-label"?: string
  /** Only the desktop app has the shortcuts (its View menu); the web keeps the browser's own zoom. */
  shortcut: string
  className?: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={ariaLabel} className={cn(ITEM, className)} {...props} />
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {IS_DESKTOP_BUILD && <span className="text-muted-foreground">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  )
}

/** The preview's text size: smaller, the current size (click for 100%), larger. */
export function PreviewZoomControl({ className }: { className?: string }) {
  const zoom = usePreviewZoom()
  const percent = Math.round(zoom * 100)

  return (
    <div
      role="group"
      aria-label="Preview text size"
      className={cn("hidden items-center gap-0.5 rounded-lg bg-muted p-0.5 sm:flex", className)}
    >
      <ZoomButton label="Zoom out" shortcut="⌘−" disabled={zoom <= ZOOM_STEPS[0]} onClick={zoomPreviewOut}>
        <MinusIcon />
      </ZoomButton>
      {/* fixed width, so the + button doesn't shift as the number changes */}
      <ZoomButton
        label="Actual size"
        aria-label={`Text size ${percent}%, reset to 100%`}
        shortcut="⌘0"
        className="w-10 text-[0.75rem] tabular-nums"
        onClick={resetPreviewZoom}
      >
        {percent}%
      </ZoomButton>
      <ZoomButton
        label="Zoom in"
        shortcut="⌘="
        disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
        onClick={zoomPreviewIn}
      >
        <PlusIcon />
      </ZoomButton>
    </div>
  )
}
