import { cn } from "@/lib/utils"

// A tile split into an editor side and a preview side, with an A drawn across both.
// Same geometry as src/app/icon.svg; keep the two in sync.
export function LogoMark({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-6 shrink-0", className)} {...props}>
      <rect width="32" height="32" rx="8" className="fill-brand" />
      <path d="M16 0H8a8 8 0 0 0-8 8v16a8 8 0 0 0 8 8h8Z" className="fill-primary" />
      <path d="M8 24l5-16h6l5 16h-4l-1.41-4.5h-5.18L12 24Zm6.34-7.5h3.32L16 11.2Z" className="fill-brand-foreground" />
      <path d="M8 24l5-16h3v3.2l-1.66 5.3H16v3h-2.59L12 24Z" className="fill-primary-foreground" />
    </svg>
  )
}
