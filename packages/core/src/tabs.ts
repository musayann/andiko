import { useSyncExternalStore } from "react"

// Open tabs of the desktop app. Each tab is a local document or a public (shared)
// one; only the active tab's editor is mounted. The list survives restarts.

export type Tab = { kind: "doc"; docId: string } | { kind: "public"; shareId: string }

export interface TabsState {
  tabs: readonly Tab[]
  /** Key of the active tab, or null while there are none. */
  active: string | null
}

const STORAGE_KEY = "andiko:tabs"
const EMPTY: TabsState = { tabs: [], active: null }

export const tabKey = (tab: Tab) => (tab.kind === "doc" ? `doc:${tab.docId}` : `public:${tab.shareId}`)

function isTab(value: unknown): value is Tab {
  if (!value || typeof value !== "object") return false
  const tab = value as Record<string, unknown>
  return (
    (tab.kind === "doc" && typeof tab.docId === "string") || (tab.kind === "public" && typeof tab.shareId === "string")
  )
}

function load(): TabsState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<TabsState> | null
    const tabs = Array.isArray(parsed?.tabs) ? parsed.tabs.filter(isTab) : []
    const active = tabs.some((tab) => tabKey(tab) === parsed?.active) ? (parsed?.active ?? null) : null
    return { tabs, active: active ?? (tabs[0] ? tabKey(tabs[0]) : null) }
  } catch {
    return EMPTY
  }
}

let state: TabsState | null = null
const listeners = new Set<() => void>()

const current = () => (state ??= load())

function set(next: TabsState) {
  state = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // storage unavailable; tabs just won't survive a restart
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export const getTabs = current

/** The tabs on the client; none on the server, where the static shell is rendered. */
export function useTabs(): TabsState {
  return useSyncExternalStore(subscribe, current, () => EMPTY)
}

/** Opens `tab`, or focuses it when it is already open. `background` leaves the active tab alone. */
export function openTab(tab: Tab, { background = false } = {}) {
  const { tabs, active } = current()
  const key = tabKey(tab)
  const exists = tabs.some((candidate) => tabKey(candidate) === key)
  set({ tabs: exists ? tabs : [...tabs, tab], active: background && active ? active : key })
}

export const openDocTab = (docId: string, options?: { background?: boolean }) =>
  openTab({ kind: "doc", docId }, options)
export const openPublicTab = (shareId: string, options?: { background?: boolean }) =>
  openTab({ kind: "public", shareId }, options)

export function activateTab(key: string) {
  const { tabs, active } = current()
  if (key !== active && tabs.some((tab) => tabKey(tab) === key)) set({ tabs, active: key })
}

/** Moves to the next (1) or previous (-1) tab, wrapping around. */
export function cycleTab(step: 1 | -1) {
  const { tabs, active } = current()
  if (tabs.length < 2) return
  const index = tabs.findIndex((tab) => tabKey(tab) === active)
  activateTab(tabKey(tabs[(index + step + tabs.length) % tabs.length]))
}

/** Activates the n-th tab (1-based); 9 means the last one, as in browsers. */
export function selectTabNumber(n: number) {
  const { tabs } = current()
  const tab = n === 9 ? tabs.at(-1) : tabs[n - 1]
  if (tab) activateTab(tabKey(tab))
}

/** Closes tabs; when the active one goes, its right neighbour (else left) takes over. */
export function closeTabs(shouldClose: (tab: Tab) => boolean) {
  const { tabs, active } = current()
  const kept = tabs.filter((tab) => !shouldClose(tab))
  if (kept.length === tabs.length) return
  let next = active
  if (!kept.some((tab) => tabKey(tab) === active)) {
    const index = tabs.findIndex((tab) => tabKey(tab) === active)
    const neighbour = tabs.slice(index + 1).find((tab) => kept.includes(tab)) ?? kept.at(-1)
    next = neighbour ? tabKey(neighbour) : null
  }
  set({ tabs: kept, active: next })
}

export const closeTab = (key: string) => closeTabs((tab) => tabKey(tab) === key)
export const closeDocTabs = (docIds: string[]) => closeTabs((tab) => tab.kind === "doc" && docIds.includes(tab.docId))

export function moveTab(from: number, to: number) {
  const { tabs, active } = current()
  if (from === to || !tabs[from] || to < 0 || to >= tabs.length) return
  const next = [...tabs]
  next.splice(to, 0, ...next.splice(from, 1))
  set({ tabs: next, active })
}
