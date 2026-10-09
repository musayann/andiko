import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "@fontsource-variable/source-sans-3/wght.css"
import "@fontsource-variable/source-sans-3/wght-italic.css"
import "@fontsource-variable/source-code-pro/wght.css"
import "katex/dist/katex.min.css"
import "@/styles/document.css"
import "./globals.css"

import { ThemeSync } from "@/components/theme-sync"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { siteDescription, siteName, siteTitle, siteUrl } from "@/lib/site"
import { themeScript } from "@/lib/theme"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    // matches the title the workspace sets client-side
    template: `%s · ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  openGraph: {
    type: "website",
    siteName,
    url: "/",
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
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
