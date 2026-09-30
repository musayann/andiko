import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "@fontsource-variable/source-sans-3/wght.css"
import "@fontsource-variable/source-sans-3/wght-italic.css"
import "@fontsource-variable/source-code-pro/wght.css"
import "katex/dist/katex.min.css"
import "@/styles/document.css"
import "./globals.css"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const title = "Andiko · Markdown editor with live preview and PDF export"
const description =
  "A local-first Markdown editor with live preview, KaTeX math, Mermaid diagrams and PDF export. No account needed: your documents stay in your browser."

export const metadata: Metadata = {
  title: {
    default: title,
    // matches the title the workspace sets client-side
    template: "%s · Andiko",
  },
  description,
  applicationName: "Andiko",
  openGraph: {
    type: "website",
    siteName: "Andiko",
    title,
    description,
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden">
        <TooltipProvider delayDuration={400}>{children}</TooltipProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  )
}
