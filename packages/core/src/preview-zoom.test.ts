import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getPreviewZoom,
  parseZoom,
  resetPreviewZoom,
  setPreviewZoom,
  stepZoom,
  subscribePreviewZoom,
  ZOOM_STEPS,
  zoomPreviewIn,
  zoomPreviewOut,
} from "./preview-zoom"

afterEach(() => resetPreviewZoom())

describe("stepZoom", () => {
  it("moves to the neighbouring step", () => {
    expect(stepZoom(1, 1)).toBe(1.1)
    expect(stepZoom(1, -1)).toBe(0.9)
  })

  it("stays put at either end", () => {
    expect(stepZoom(ZOOM_STEPS[ZOOM_STEPS.length - 1], 1)).toBe(2)
    expect(stepZoom(ZOOM_STEPS[0], -1)).toBe(0.75)
  })

  it("snaps a value between steps to the next one", () => {
    expect(stepZoom(1.2, 1)).toBe(1.25)
    expect(stepZoom(1.2, -1)).toBe(1.1)
  })
})

describe("parseZoom", () => {
  it("accepts only the steps", () => {
    expect(parseZoom("1.25")).toBe(1.25)
    expect(parseZoom("1.3")).toBe(1)
    expect(parseZoom("huge")).toBe(1)
    expect(parseZoom(null)).toBe(1)
  })
})

describe("preview zoom", () => {
  it("steps, saves and notifies", () => {
    const listener = vi.fn()
    const unsubscribe = subscribePreviewZoom(listener)
    zoomPreviewIn()
    zoomPreviewIn()
    expect(getPreviewZoom()).toBe(1.25)
    expect(localStorage.getItem("andiko:preview-zoom")).toBe("1.25")
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
  })

  it("doesn't notify when nothing changes", () => {
    setPreviewZoom(0.75)
    const listener = vi.fn()
    const unsubscribe = subscribePreviewZoom(listener)
    zoomPreviewOut()
    setPreviewZoom(0.75)
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  it("follows changes made in another tab", () => {
    const listener = vi.fn()
    const unsubscribe = subscribePreviewZoom(listener)
    window.dispatchEvent(new StorageEvent("storage", { key: "andiko:preview-zoom", newValue: "1.5" }))
    expect(getPreviewZoom()).toBe(1.5)
    expect(listener).toHaveBeenCalledOnce()
    unsubscribe()
  })
})
