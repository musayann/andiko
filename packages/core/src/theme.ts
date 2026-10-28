export type Theme = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

/** New visitors get the light theme, whatever their OS prefers. */
export const DEFAULT_THEME: Theme = "light"

const STORAGE_KEY = "andiko:theme"
const DARK_QUERY = "(prefers-color-scheme: dark)"

/**
 * Runs in <head> before the first paint so a saved dark theme doesn't flash
 * light while the app loads. Must agree with parseTheme() and resolveTheme().
 */
export const themeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(t==="dark"||(t==="system"&&matchMedia(${JSON.stringify(DARK_QUERY)}).matches))document.documentElement.classList.add("dark")}catch(e){}})()`

function parseTheme(value: string | null): Theme {
  return value === "dark" || value === "system" ? value : DEFAULT_THEME
}

// kept in memory too, so switching still works when storage is blocked
let current: Theme | undefined
const listeners = new Set<() => void>()

export function getTheme(): Theme {
  if (current === undefined) {
    try {
      current = parseTheme(localStorage.getItem(STORAGE_KEY))
    } catch {
      current = DEFAULT_THEME
    }
  }
  return current
}

export function setTheme(theme: Theme) {
  current = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // storage unavailable; the choice lasts until the page is reloaded
  }
  for (const listener of listeners) listener()
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") return window.matchMedia(DARK_QUERY).matches ? "dark" : "light"
  return theme
}

/** Calls `onChange` when the theme is set here or in another tab, or the OS theme changes. */
export function subscribeTheme(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY)
  const onStorage = (event: StorageEvent) => {
    // key is null when another tab clears storage
    if (event.key !== STORAGE_KEY && event.key !== null) return
    current = parseTheme(event.newValue)
    onChange()
  }
  listeners.add(onChange)
  media.addEventListener("change", onChange)
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(onChange)
    media.removeEventListener("change", onChange)
    window.removeEventListener("storage", onStorage)
  }
}

/** Sets the `.dark` class on <html>, switching instantly rather than animating every transition. */
export function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement
  const dark = theme === "dark"
  if (root.classList.contains("dark") === dark) return

  const pause = document.createElement("style")
  pause.textContent = "*,*::before,*::after{transition:none!important}"
  document.head.append(pause)
  root.classList.toggle("dark", dark)
  // flush styles with transitions off, then turn them back on
  void getComputedStyle(root).color
  requestAnimationFrame(() => pause.remove())
}
