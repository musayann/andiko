"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

/** The desktop app has no landing page: it opens straight into the editor. */
export function DesktopRedirect() {
  const router = useRouter()
  useEffect(() => router.replace("/d"), [router])
  return null
}
