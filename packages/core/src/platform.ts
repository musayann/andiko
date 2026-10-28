// The same code ships as the website and as the desktop app (Tauri), where the UI
// is bundled and the few server features (sharing, PDF fallback) are called remotely.

/** True when running inside the Tauri webview. */
export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

/** True in the desktop app's static build (set in apps/desktop/next.config.ts). */
export const IS_DESKTOP_BUILD = process.env.NEXT_PUBLIC_DESKTOP === "1"

/** The desktop app's URL scheme (see apps/desktop/src-tauri/tauri.conf.json): `andiko://s/…` opens what `https://andiko.app/s/…` shows. */
export const APP_SCHEME = "andiko"

/** Where the server lives: the public site for the desktop app, the same origin on the web. */
export const API_BASE = IS_DESKTOP_BUILD
  ? (process.env.NEXT_PUBLIC_SITE_URL || "https://andiko.app").replace(/\/+$/, "")
  : ""

/** Opens a link in the system browser from the desktop app, in a new tab on the web. */
export async function openExternal(url: string) {
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener")
    await openUrl(url)
  } else {
    window.open(url, "_blank", "noopener,noreferrer")
  }
}
