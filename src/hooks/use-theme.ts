import { useSyncExternalStore } from "react"

import { DEFAULT_THEME, getTheme, resolveTheme, setTheme, subscribeTheme, type ResolvedTheme } from "@/lib/theme"

const getResolvedTheme = () => resolveTheme(getTheme())
const getServerResolvedTheme = (): ResolvedTheme => "light"

export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => DEFAULT_THEME)
  const resolvedTheme = useSyncExternalStore(subscribeTheme, getResolvedTheme, getServerResolvedTheme)
  return { theme, resolvedTheme, setTheme }
}
