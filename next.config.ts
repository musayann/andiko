import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The PDF route reads these at runtime (see src/lib/pdf/template.ts).
  // puppeteer-core and @sparticuz/chromium are already external by default.
  outputFileTracingIncludes: {
    "/api/export/pdf": [
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
