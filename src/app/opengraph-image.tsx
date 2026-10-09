import { ImageResponse } from "next/og"

import { siteName } from "@/lib/site"

export const alt = "Andiko, a free online Markdown editor with live preview and PDF export"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const features = ["Live preview", "KaTeX maths", "Mermaid", "PDF export", "No sign-up"]

// Rendered at build time with next/og's bundled Geist, the app's UI font.
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: "#fafafa",
        color: "#171717",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
        {/* same geometry and colours as src/app/icon.svg */}
        <svg width="148" height="148" viewBox="0 0 32 32">
          <rect width="32" height="32" rx="8" fill="#fdc700" />
          <path d="M16 0H8a8 8 0 0 0-8 8v16a8 8 0 0 0 8 8h8Z" fill="#171717" />
          <path d="M8 24l5-16h6l5 16h-4l-1.41-4.5h-5.18L12 24Zm6.34-7.5h3.32L16 11.2Z" fill="#171717" />
          <path d="M8 24l5-16h3v3.2l-1.66 5.3H16v3h-2.59L12 24Z" fill="#fafafa" />
        </svg>
        <div style={{ fontSize: 112, letterSpacing: -4 }}>{siteName}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
        <div style={{ fontSize: 64, lineHeight: 1.1, letterSpacing: -2, maxWidth: 1000 }}>
          Markdown editor with live preview and PDF export
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {features.map((feature) => (
            <div
              key={feature}
              style={{
                display: "flex",
                padding: "10px 22px",
                borderRadius: 999,
                background: "#171717",
                color: "#fafafa",
                fontSize: 28,
              }}
            >
              {feature}
            </div>
          ))}
        </div>
      </div>
    </div>,
    size,
  )
}
