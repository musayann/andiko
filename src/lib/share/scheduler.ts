import { syncSharedDocs } from "./client"

// When local edits of published documents are pushed, and whether pushing is
// currently failing (offline or a server error), for the sync status in the UI.

const SYNC_DELAY = 2000
const RETRY_DELAY = 30_000

let timer: ReturnType<typeof setTimeout> | undefined
let failing = false
const listeners = new Set<() => void>()

function setFailing(next: boolean) {
  if (failing === next) return
  failing = next
  for (const listener of listeners) listener()
}

/** True after a sync that couldn't reach the server or was refused by it, until one succeeds. */
export const isSyncFailing = () => failing

export function subscribeSyncFailing(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

/** Syncs after `delay` unless a sync is already due: a throttle, so a long typing session still syncs. */
export function scheduleSync(delay = SYNC_DELAY) {
  if (timer !== undefined) return
  timer = setTimeout(async () => {
    // cleared before the push so saves made during it schedule the next one
    timer = undefined
    const done = await syncSharedDocs().catch(() => false)
    setFailing(!done)
    if (!done) scheduleSync(RETRY_DELAY)
  }, delay)
}

export function cancelSync() {
  clearTimeout(timer)
  timer = undefined
}

export function syncNow() {
  cancelSync()
  scheduleSync(0)
}
