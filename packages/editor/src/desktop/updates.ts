"use client"

import { useEffect } from "react"
import { toast } from "sonner"

// the app tends to stay open for days
const CHECK_INTERVAL = 4 * 60 * 60 * 1000
const TOAST_ID = "update"

let installing: Promise<string | null> | undefined
// once an update is on disk, the next launch runs it and there is nothing more to check
let installed: string | null = null

/** Installs a newer release over the app, if there is one (the endpoint is in src-tauri/tauri.conf.json), and returns its version. */
async function install() {
  const { check } = await import("@tauri-apps/plugin-updater")
  const update = await check()
  if (!update) return null
  await update.downloadAndInstall()
  return update.version
}

async function restart() {
  // useDoc saves and backs up unsaved text on pagehide, which a relaunch doesn't fire
  window.dispatchEvent(new Event("pagehide"))
  await new Promise((resolve) => setTimeout(resolve, 300))
  const { relaunch } = await import("@tauri-apps/plugin-process")
  await relaunch()
}

function offerRestart(version: string) {
  toast(`Andiko ${version} is installed`, {
    id: TOAST_ID,
    description: "Restart to use it, or it opens next time.",
    duration: Infinity,
    action: { label: "Restart", onClick: () => restart().catch(() => toast.error("Could not restart Andiko")) },
  })
}

/**
 * Installs a newer release in the background and offers a restart. Only a check from the
 * menu (see src-tauri/src/lib.rs) says when there is nothing new or the check failed.
 */
export async function checkForUpdates(manual: boolean) {
  // a development build would replace itself with the release
  if (process.env.NODE_ENV !== "production") {
    if (manual) toast("Updates are off in development")
    return
  }
  if (installed) {
    if (manual) offerRestart(installed)
    return
  }
  if (manual) toast.loading("Checking for updates…", { id: TOAST_ID })
  try {
    // a check still running, like the one at launch, is joined rather than repeated
    installed = await (installing ??= install().finally(() => (installing = undefined)))
    if (installed) offerRestart(installed)
    else if (manual) toast("Andiko is up to date", { id: TOAST_ID })
  } catch {
    if (manual) toast.error("Could not check for updates", { id: TOAST_ID })
  }
}

/** Checks for updates at launch and every few hours after. */
export function useUpdates() {
  useEffect(() => {
    void checkForUpdates(false)
    const timer = setInterval(() => void checkForUpdates(false), CHECK_INTERVAL)
    return () => clearInterval(timer)
  }, [])
}
