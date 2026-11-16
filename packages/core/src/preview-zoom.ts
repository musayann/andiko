import { useSyncExternalStore } from "react"

/** Text sizes the preview steps through, as a factor of its 16px base (see document.css). */
export const ZOOM_STEPS = [0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2] as const

const DEFAULT_ZOOM = 1
const STORAGE_KEY = "andiko:preview-zoom"

export function parseZoom(value: string | null): number {
  const zoom = Number(value)
  return (ZOOM_STEPS as readonly number[]).includes(zoom) ? zoom : DEFAULT_ZOOM
}

/** The next step up or down from `zoom`, staying put at either end. */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  if (direction === 1) return ZOOM_STEPS.find((step) => step > zoom) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]
  return ZOOM_STEPS.findLast((step) => step < zoom) ?? ZOOM_STEPS[0]
}

// kept in memory too, so zooming still works when storage is blocked
let current: number | undefined
const listeners = new Set<() => void>()

export function getPreviewZoom(): number {
  if (current === undefined) {
    try {
      current = parseZoom(localStorage.getItem(STORAGE_KEY))
    } catch {
      current = DEFAULT_ZOOM
    }
  }
  return current
}

export function setPreviewZoom(zoom: number) {
  const next = parseZoom(String(zoom))
  if (next === getPreviewZoom()) return
  current = next
  try {
    localStorage.setItem(STORAGE_KEY, String(next))
  } catch {
    // storage unavailable; the zoom lasts until the page is reloaded
  }
  for (const listener of listeners) listener()
}

export const zoomPreviewIn = () => setPreviewZoom(stepZoom(getPreviewZoom(), 1))
export const zoomPreviewOut = () => setPreviewZoom(stepZoom(getPreviewZoom(), -1))
export const resetPreviewZoom = () => setPreviewZoom(DEFAULT_ZOOM)

/** Calls `onChange` when the zoom is set here or in another tab. */
export function subscribePreviewZoom(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    // key is null when another tab clears storage
    if (event.key !== STORAGE_KEY && event.key !== null) return
    current = parseZoom(event.newValue)
    onChange()
  }
  listeners.add(onChange)
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onStorage)
  }
}

/** The preview's text zoom; 1 on the server. */
export function usePreviewZoom(): number {
  return useSyncExternalStore(subscribePreviewZoom, getPreviewZoom, () => DEFAULT_ZOOM)
}
