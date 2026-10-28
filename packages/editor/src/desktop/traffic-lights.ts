"use client"

import { useEffect, useState } from "react"

import { IS_DESKTOP_BUILD } from "@andiko/core/platform"

/**
 * Whether the window's traffic lights are drawn over the page, which must leave room for them.
 * The desktop app overlays its title bar (see src-tauri/tauri.conf.json), so they always are,
 * except in full screen, where macOS hides them.
 */
export function useTrafficLights() {
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    if (!IS_DESKTOP_BUILD) return
    let unlisten: (() => void) | undefined
    let cancelled = false

    void import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
      const appWindow = getCurrentWindow()
      const update = async () => setFullscreen(await appWindow.isFullscreen())
      // entering and leaving full screen resizes the window
      const stop = await appWindow.onResized(() => void update())
      if (cancelled) stop()
      else {
        unlisten = stop
        void update()
      }
    })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])

  return IS_DESKTOP_BUILD && !fullscreen
}
