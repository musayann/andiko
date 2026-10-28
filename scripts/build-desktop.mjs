// Builds the static bundle the Tauri app loads (out/).
//
// The desktop app is the editor only: documents live on the device, and the few server
// features are called on the website's API. A static export can't contain server routes,
// so those are set aside while Next builds, and always put back afterwards.

import { spawnSync } from "node:child_process"
import { cpSync, existsSync, mkdtempSync, renameSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const SERVER_ONLY = [
  "src/app/api", // sharing and PDF routes
  "src/app/s", // server-rendered public pages
  "src/app/d/[id]", // per-document routes; the app uses tabs on /d
  "src/app/opengraph-image.tsx",
  "src/app/manifest.ts", // web metadata for crawlers and installs
  "src/app/sitemap.ts",
  "src/app/robots.ts",
  "src/app/privacy", // the app links to the website for these
  "src/app/terms",
  "src/proxy.ts",
]

const aside = mkdtempSync(join(tmpdir(), "andiko-desktop-"))
const moved = []

function restore() {
  for (const path of moved.reverse()) {
    renameOrCopy(join(aside, path.replaceAll("/", "__")), path)
  }
  moved.length = 0
  rmSync(aside, { recursive: true, force: true })
}

// tmpdir may be on another volume, where rename fails
function renameOrCopy(from, to) {
  try {
    renameSync(from, to)
  } catch {
    cpSync(from, to, { recursive: true })
    rmSync(from, { recursive: true, force: true })
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    restore()
    process.exit(1)
  })
}

let status = 1
try {
  for (const path of SERVER_ONLY) {
    if (!existsSync(path)) continue
    renameOrCopy(path, join(aside, path.replaceAll("/", "__")))
    moved.push(path)
  }
  rmSync(".next", { recursive: true, force: true })
  const result = spawnSync("pnpm", ["exec", "next", "build"], {
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_DESKTOP: "1" },
  })
  status = result.status ?? 1
} finally {
  restore()
  // the web build's cached types and routes name the files that were just set aside
  rmSync(".next", { recursive: true, force: true })
}
process.exit(status)
