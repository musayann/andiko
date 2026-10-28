import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import prettier from "eslint-config-prettier/flat"

// Shared by every workspace: the apps are Next apps, and the packages are compiled by them.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // App Router only; in the packages it just warns that there is no pages directory.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  // Last, so formatting is left to Prettier.
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Rust build output, which includes generated JS
    "src-tauri/target/**",
    "src-tauri/gen/**",
  ]),
])
