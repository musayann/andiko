import type { NextConfig } from "next"

// `pnpm build:desktop` exports the editor as static files for the Tauri app (see scripts/build-desktop.mjs).
const desktop = process.env.NEXT_PUBLIC_DESKTOP === "1"

const nextConfig: NextConfig = {
  // Tauri serves files as they are: no rewrites, so every route needs its own index.html
  ...(desktop && { output: "export" as const, trailingSlash: true, images: { unoptimized: true } }),
  // The PDF route reads these at runtime (see src/lib/pdf/template.ts).
  // puppeteer-core and @sparticuz/chromium are already external by default,
  // but chromium locates its compressed binary from `import.meta.url`, which
  // the tracer can't follow, so its bin/ folder has to be listed explicitly.
  outputFileTracingIncludes: {
    "/api/export/pdf": [
      "./node_modules/@sparticuz/chromium/bin/*.br",
      "./src/styles/document.css",
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
