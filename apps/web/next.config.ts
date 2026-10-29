import { existsSync } from "node:fs"
import path from "node:path"

import type { NextConfig } from "next"

// the repo's shared .env (see .env.sample). Next has already loaded this app's own
// .env* files, and loadEnvFile keeps values that are set, so those win over it.
const rootEnv = path.join(__dirname, "../../.env")
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv)

const nextConfig: NextConfig = {
  // trace from the repo root, so serverless functions can ship files from packages/
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // The PDF route reads these at runtime (see src/lib/pdf/template.ts).
  // puppeteer-core and @sparticuz/chromium are already external by default,
  // but chromium locates its compressed binary from `import.meta.url`, which
  // the tracer can't follow, so its bin/ folder has to be listed explicitly.
  outputFileTracingIncludes: {
    "/api/export/pdf": [
      "./node_modules/@sparticuz/chromium/bin/*.br",
      "./node_modules/@andiko/core/src/styles/document.css",
      "./node_modules/katex/dist/katex.min.css",
      "./node_modules/katex/dist/fonts/*.woff2",
      "./node_modules/@fontsource-variable/source-sans-3/*.css",
      "./node_modules/@fontsource-variable/source-sans-3/files/*.woff2",
      "./node_modules/@fontsource-variable/source-code-pro/*.css",
      "./node_modules/@fontsource-variable/source-code-pro/files/*.woff2",
    ],
  },
}

export default nextConfig
