"use client"

import { LoaderCircleIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { LogoMark } from "@/components/logo"
import { resolveStartDoc } from "@/lib/db"

export default function Home() {
  const router = useRouter()
  const [error, setError] = useState(false)

  useEffect(() => {
    resolveStartDoc().then(
      (id) => router.replace(`/d/${id}`),
      () => setError(true),
    )
  }, [router])

  return (
    <main className="flex h-full flex-col items-center justify-center gap-4 p-8 text-sm text-muted-foreground">
      <LogoMark className="size-10" />
      {error ? (
        <p className="max-w-sm text-center">
          Andiko stores documents in your browser (IndexedDB), which seems to be unavailable. Private browsing
          modes sometimes block it.
        </p>
      ) : (
        <LoaderCircleIcon className="size-5 animate-spin" aria-label="Loading" />
      )}
    </main>
  )
}
