import type { Metadata } from "next"
import { cookies } from "next/headers"

import { AppSidebar } from "@/components/app-sidebar"
import { ShareSync } from "@/components/share-sync"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { sharingEnabled } from "@/lib/share/store"

// Documents live in the visitor's IndexedDB, so crawlers only ever see an empty shell.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function DocsLayout({ children }: LayoutProps<"/d">) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    <SidebarProvider defaultOpen={defaultOpen} className="h-svh">
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-hidden md:peer-data-[variant=inset]:ring-1 md:peer-data-[variant=inset]:ring-sidebar-border">
        {children}
      </SidebarInset>
      {sharingEnabled() && <ShareSync />}
    </SidebarProvider>
  )
}
