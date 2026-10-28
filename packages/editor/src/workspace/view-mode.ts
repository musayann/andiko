export type ViewMode = "edit" | "split" | "view"

const MODE_KEY = "andiko:view-mode"
const SPLIT_KEY = "andiko:split"
const SYNC_KEY = "andiko:scroll-sync"

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage unavailable; preferences just won't persist
  }
}

export function loadViewMode(): ViewMode {
  const value = read(MODE_KEY)
  return value === "edit" || value === "view" ? value : "split"
}

export const saveViewMode = (mode: ViewMode) => write(MODE_KEY, mode)

/** Editor width in percent while in split mode. */
export function loadSplit(): number {
  const value = Number(read(SPLIT_KEY))
  return value >= 20 && value <= 80 ? value : 50
}

export const saveSplit = (percent: number) => write(SPLIT_KEY, String(Math.round(percent)))

export const loadScrollSync = () => read(SYNC_KEY) !== "off"

export const saveScrollSync = (enabled: boolean) => write(SYNC_KEY, enabled ? "on" : "off")
