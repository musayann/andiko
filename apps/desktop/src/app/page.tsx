import { AppSidebar } from "@andiko/editor/app-sidebar"
import { DesktopShell } from "@andiko/editor/desktop/desktop-shell"
import { ShareSync } from "@andiko/editor/share-sync"
import { SidebarInset, SidebarProvider } from "@andiko/ui/components/sidebar"

// The whole app is this one page: documents open in tabs instead of routes.
export default function DesktopApp() {
  return (
    <SidebarProvider className="h-svh">
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-hidden md:peer-data-[variant=inset]:ring-1 md:peer-data-[variant=inset]:ring-sidebar-border">
        <DesktopShell />
      </SidebarInset>
      <ShareSync />
      {/* the gutter along the window's top edge, above the sidebar's and tab bar's drag regions */}
      <div data-tauri-drag-region className="fixed inset-x-0 top-0 z-20 h-2" />
    </SidebarProvider>
  )
}
