import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "@fontsource-variable/source-sans-3/wght.css"
import "@fontsource-variable/source-sans-3/wght-italic.css"
import "@fontsource-variable/source-code-pro/wght.css"
import "katex/dist/katex.min.css"
import "@andiko/core/document.css"
import "@andiko/ui/globals.css"

import { siteName } from "@andiko/core/site"
import { themeScript } from "@andiko/core/theme"
import { Toaster } from "@andiko/ui/components/sonner"
import { ThemeSync } from "@andiko/ui/components/theme-sync"
import { TooltipProvider } from "@andiko/ui/components/tooltip"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: siteName,
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // the head script adds `.dark` before hydration, so React must accept the class it finds
    <html
      lang="en-RW"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="h-full">
        <ThemeSync />
        <TooltipProvider delayDuration={400}>{children}</TooltipProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  )
}
