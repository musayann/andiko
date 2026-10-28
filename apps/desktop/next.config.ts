import type { NextConfig } from "next"

// The Tauri app loads this build from disk (out/): no server, so a static export.
const nextConfig: NextConfig = {
  output: "export",
  // Tauri serves files as they are: no rewrites, so every route needs its own index.html
  trailingSlash: true,
  images: { unoptimized: true },
  // inlined into the shared packages, which open documents in tabs and call the website's API
  env: { NEXT_PUBLIC_DESKTOP: "1" },
}

export default nextConfig
