import type { NextConfig } from "next"

const nextConfig: NextConfig = {
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
