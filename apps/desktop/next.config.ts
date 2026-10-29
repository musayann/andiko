import { existsSync } from "node:fs"
import path from "node:path"

import type { NextConfig } from "next"

// the repo's shared .env (see .env.sample). Next has already loaded this app's own
// .env* files, and loadEnvFile keeps values that are set, so those win over it.
const rootEnv = path.join(__dirname, "../../.env")
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv)

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
