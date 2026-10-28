import type { Menu, MenuItemOptions, PredefinedMenuItemOptions, SubmenuOptions } from "@tauri-apps/api/menu"

import { isTauri } from "@andiko/core/platform"

export type ContextMenuItem = MenuItemOptions | PredefinedMenuItemOptions | SubmenuOptions

export const SEPARATOR: PredefinedMenuItemOptions = { item: "Separator" }

/** Shortcut keys pressed together with Cmd (Mac) or Ctrl, e.g. ["Shift", "X"], as a menu accelerator. */
export const accelerator = (keys?: string[]) => keys && ["CmdOrCtrl", ...keys].join("+")

// popup() resolves once the menu shows, not once an item is picked, so each menu lives until the next opens
let shown: Menu | undefined

/**
 * Shows a native menu at the pointer instead of the webview's own (Reload, Inspect Element…).
 * Only in the desktop app: on the web the browser's menu stays. Falsy entries are left out.
 */
export function showContextMenu(
  event: { preventDefault: () => void },
  items: (ContextMenuItem | false | null | undefined)[],
) {
  if (!isTauri()) return
  event.preventDefault()

  void import("@tauri-apps/api/menu").then(async ({ Menu }) => {
    const menu = await Menu.new({ items: items.filter((item): item is ContextMenuItem => !!item) })
    void shown?.close()
    shown = menu
    await menu.popup()
  })
}
