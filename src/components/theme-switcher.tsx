"use client"

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useTheme } from "@/hooks/use-theme"
import type { Theme } from "@/lib/theme"
import { cn } from "@/lib/utils"

const THEMES: { value: Theme; label: string; icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
]

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  return (
    // same segmented control as the toolbar's view modes, on the sidebar's grey
    <ToggleGroup
      type="single"
      spacing={0.5}
      value={theme}
      onValueChange={(value) => value && setTheme(value as Theme)}
      aria-label="Theme"
      className={cn("rounded-lg bg-sidebar-accent p-0.5", className)}
    >
      {THEMES.map(({ value, label, icon: Icon }) => (
        <Tooltip key={value}>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value={value}
              aria-label={label}
              className="size-6 min-w-6 rounded-md p-0 text-muted-foreground hover:bg-transparent hover:text-foreground aria-checked:bg-background aria-checked:text-foreground aria-checked:shadow-xs aria-checked:ring-1 aria-checked:ring-foreground/5 dark:aria-checked:bg-input [&_svg:not([class*='size-'])]:size-3.5"
            >
              <Icon />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  )
}
