"use client"

import { useLayoutEffect } from "react"

import { applyTheme, getTheme, resolveTheme, subscribeTheme } from "@/lib/theme"

/**
 * Keeps the `.dark` class on <html> in line with the chosen theme. The inline
 * head script sets it on load; this follows later changes and restores it after
 * React's development remount resets the <html> attributes.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    const sync = () => applyTheme(resolveTheme(getTheme()))
    sync()
    return subscribeTheme(sync)
  }, [])
  return null
}
