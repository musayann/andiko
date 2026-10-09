import Link from "next/link"
import type { ReactNode } from "react"

import { LogoMark } from "@/components/logo"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { Button } from "@/components/ui/button"
import { siteName } from "@/lib/site"

interface LegalPageProps {
  title: string
  /** Shown as "Last updated …"; change it whenever the text changes. */
  updated: string
  children: ReactNode
}

/** The frame shared by the privacy policy and the terms: the site header and one column of prose. */
export function LegalPage({ title, updated, children }: LegalPageProps) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <LogoMark />
          {siteName}
        </Link>
        <nav className="flex items-center gap-2">
          <ThemeSwitcher className="hidden bg-muted sm:flex" />
          <Button asChild>
            <Link href="/d">Open editor</Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-8 pb-16 sm:px-6">
        <article className="markdown-body">
          <h1>{title}</h1>
          <p>
            <em>Last updated {updated}</em>
          </p>
          {children}
        </article>
      </main>
    </div>
  )
}

interface OperatorDetailsProps {
  name: string
  /** A company's registered office. */
  address?: string
  /** A company's register and number, e.g. "Registered in Rwanda, company code 123456789". */
  registration?: string
}

/** Who runs this instance, for a company with its legal details; nothing when neither is set, as the text names them. */
export function OperatorDetails({ name, address, registration }: OperatorDetailsProps) {
  if (!address && !registration) return null
  return (
    <p>
      <strong>{name}</strong>
      {address && (
        <>
          <br />
          {address}
        </>
      )}
      {registration && (
        <>
          <br />
          {registration}
        </>
      )}
    </p>
  )
}
