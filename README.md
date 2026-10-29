<img src="apps/web/src/app/icon.svg" width="64" height="64" alt="Andiko logo">

# Andiko

A local-first Markdown editor with live preview and PDF export, on the web and as a Mac app. Built with Next.js, shadcn/ui, CodeMirror and markdown-it.

- **Edit / Split / View**: write on one side and read on the other, or hide either side (<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>E</kbd> / <kbd>B</kbd> / <kbd>V</kbd>). Drag the divider to resize. The panes stay scroll-synced.
- **Formatting bar**: buttons above the editor for headings, bold, italic, strikethrough, highlight, inline code, sub/superscript, quotes, lists, task lists, links, images, tables (pick a size from a grid), code blocks and dividers. An Insert menu adds alert boxes, spoilers, math blocks and Mermaid diagrams. Shortcuts: <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>B</kbd> bold, <kbd>I</kbd> italic, <kbd>Shift</kbd>+<kbd>X</kbd> strikethrough, <kbd>E</kbd> inline code, <kbd>K</kbd> link.
- **Extended Markdown**:
  - alert boxes (`:::info`, `:::success`, `:::warning`, `:::danger`) and `:::spoiler`
  - `[TOC]`, KaTeX math (`$…$`, `$$…$$`) and Mermaid diagrams
  - code blocks with line numbers (` ```js= `, `=101`, `=+`) and wrapping (`!`)
  - task lists you can click in the preview
  - footnotes, definition lists, abbreviations, `==mark==`, `++ins++`, `~sub~`, `^sup^` and emoji shortcodes
  - YAML front matter (`title`, `tags`, `breaks`)
- **PDF export**: a real download rendered by headless Chrome on the server, with selectable text, embedded fonts and page numbers. Browser printing is available as a fallback.
- **Local-first**: documents live in the browser (IndexedDB), or in the Mac app, in a database on the Mac. You can import and download `.md` files. There is no account, and only documents you share are stored on the server.
- **Sharing**: Share publishes a read-only link at `/s/<title>-<id>`. Only the id identifies the document: links made before a title change, or with a bare id, redirect to the current title. Your later edits sync to it automatically, and only your browser can edit or unpublish it (the instance's operator can still remove it). Visitors can save their own editable copy, which never touches the original.
- **Folders (optional)**: group documents in nested folders. Move them with the ⋯ menu or by dragging in the sidebar. Documents without a folder stay at the top level, as before.

## Getting started

Requires Node 24 (24.22.1 or newer) and pnpm. `.nvmrc` names the version, so `nvm use` picks it up.

```bash
pnpm install        # also downloads Chrome for local PDF export (puppeteer)
pnpm dev            # the website, at http://localhost:3000
```

Configuration is optional. Copy `.env.sample` to `.env` at the repo root to enable sharing (`DATABASE_URL`) or to change the other settings it lists. Both apps read it when they start, so restart `pnpm dev` or `pnpm dev:desktop` after changing it; a value in `apps/<app>/.env.local` overrides it for that app only. It's for local development: deployments and the release workflow set their own variables.

The first visit seeds a "Welcome" document that shows every supported feature.

The repo is a pnpm workspace run by [Turborepo](https://turborepo.com). The root scripts run the task in every workspace that has it:

| Script               | Purpose                                                   |
| -------------------- | --------------------------------------------------------- |
| `pnpm dev`           | Website development server (Turbopack)                    |
| `pnpm dev:desktop`   | Mac app in development (Tauri, with hot reload)           |
| `pnpm build`         | Production builds of the website and the desktop frontend |
| `pnpm build:desktop` | Mac app bundle (`.app` and `.dmg`)                        |
| `pnpm test`          | Unit tests (Vitest)                                       |
| `pnpm lint`          | ESLint                                                    |
| `pnpm typecheck`     | Generate route types and run `tsc`                        |

To run a task in one workspace, filter it, e.g. `pnpm --filter @andiko/core test`.

The Mac app's SQLite store has Rust tests: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`.

## Mac app

`apps/desktop` wraps the editor in [Tauri](https://tauri.app). Its frontend is a static export of the same components, loaded from disk, so documents stay on the Mac and editing works offline. They are kept in a SQLite database at `~/Library/Application Support/app.andiko.desktop/andiko.db`, where Time Machine backs them up, together with the open tabs and the key to your published documents (`pnpm dev:desktop` uses `andiko-dev.db` next to it). On first launch, the app moves in what earlier versions kept in WebKit's storage. Documents open in tabs (<kbd>⌘</kbd><kbd>T</kbd> new, <kbd>⌘</kbd><kbd>W</kbd> close, <kbd>⌘</kbd><kbd>1</kbd>–<kbd>9</kbd>, <kbd>⌘</kbd><kbd>L</kbd> opens a shared link in a tab). Links to the site in a document open in a tab too, and the app handles the `andiko://` scheme: `andiko://s/<slug>-<id>` opens what `https://andiko.app/s/<slug>-<id>` shows (macOS registers it when the app is installed, so it doesn't reach `pnpm dev:desktop`). Sharing and the PDF fallback call the website's API at `NEXT_PUBLIC_SITE_URL`; PDF export otherwise uses the system print dialog. Its Help menu opens that site, the project's GitHub issues, and the site's privacy policy and terms of use (Help → Privacy Policy); its Report link on shared documents writes to `NEXT_PUBLIC_CONTACT_EMAIL`, which the release build reads from the repo's Actions variable of the same name. `pnpm dev:desktop` and local builds read both from the root `.env`; the app's CSP only allows `https://andiko.app`, so keep any other `NEXT_PUBLIC_SITE_URL` in `apps/web/.env.local`. Building it needs Rust (`cargo`).

Every push to `main` is released: the [Desktop macOS build](.github/workflows/desktop-macos.yml) workflow publishes a universal `.dmg` (Apple Silicon and Intel) to [Releases](https://github.com/musayann/andiko/releases), versioned `<major.minor>.<run number>` from `apps/desktop/package.json`. It is ad-hoc signed, not notarized: on first launch, allow it in System Settings → Privacy & Security → Open Anyway (or run `xattr -dr com.apple.quarantine /Applications/Andiko.app`). After that the app updates itself: it checks the latest release's `latest.json` at launch and every few hours (or from Andiko → Check for Updates…), installs a newer version in the background and offers to restart. Updates are signed with a key kept in the repo's `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secrets, whose public half is `plugins.updater.pubkey` in `tauri.conf.json`; installed apps only accept updates signed with it, so losing the key means they can't update again.

The app icon is drawn in Icon Composer (`apps/desktop/src-tauri/icons/andiko.icon`), but builds use the `Assets.car` compiled from it next to it, because `actool` in some Xcode 26 releases crashes on `.icon` files. After changing the icon, run `pnpm --filter @andiko/desktop icon:car` and commit the new `Assets.car`.

## Deployment

Canonical links, the sitemap, `robots.txt` and Open Graph images use `https://andiko.app`. If you self-host on another domain, set `NEXT_PUBLIC_SITE_URL` to its origin (e.g. `https://notes.example.com`).

Sharing needs a Postgres database. Set `DATABASE_URL` (for example Neon or Supabase on Vercel, or `postgres://postgres:pg@localhost:5432/postgres` after `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=pg postgres`). The `shares` table is created on first use. Without `DATABASE_URL` the Share button is hidden and everything else works as before.

The privacy policy (`/privacy`) and terms (`/terms`) name whoever runs the instance, so they are only published when `NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_CONTACT_EMAIL` and `NEXT_PUBLIC_DATABASE_REGION` are set; the root `.env.sample` lists the optional details. The contact email also adds a Report link to shared pages. The policy names Vercel and Neon as providers, and both pages describe the Mac app released from this repo, so edit `apps/web/src/app/privacy/page.tsx` and `apps/web/src/app/terms/page.tsx` if you host elsewhere or don't ship the app.

On Vercel, set the project's Root Directory to `apps/web`.

`/` is a static landing page for new visitors and search engines. Once someone has opened a document, a cookie makes `/` redirect them to `/d`, which reopens their last document.

## PDF export

`POST /api/export/pdf` receives the rendered document HTML from the client. It loads it into headless Chrome with the same stylesheet as the preview (`packages/core/src/styles/document.css`) and returns the PDF. Mermaid diagrams are rendered in the browser first.

The route picks a Chrome in this order:

| Environment                     | Chrome used                                                    |
| ------------------------------- | -------------------------------------------------------------- |
| Vercel / AWS Lambda             | [`@sparticuz/chromium`](https://github.com/Sparticuz/chromium) |
| `CHROME_EXECUTABLE_PATH` is set | That binary (e.g. `/usr/bin/chromium` in Docker)               |
| Local development               | The Chrome downloaded by the `puppeteer` dev dependency        |

For Docker or other self-hosting, install Chromium in the image and set `CHROME_EXECUTABLE_PATH`. Serverless Chromium ships with few system fonts, so emoji and CJK text may need extra fonts (see `chromium.font()` in the sparticuz docs).

### Security

The export HTML comes from the client, so the route treats it as untrusted:

- JavaScript is disabled in the page, and a CSP only allows inline styles and `https:`/`data:` images.
- Every request is checked. Only public `https:` hosts and `data:` URIs are allowed. Localhost, private, link-local and metadata IPs are blocked after DNS resolution.
- Request bodies are capped at 5 MB.

## Sharing

There are no accounts. The first time the editor opens, the browser gets a random owner token, kept in localStorage. The server stores only its SHA-256 hash next to each shared document, and only requests carrying that token can update or unpublish it. Clearing site data loses the token, so the browser can no longer change its shared documents; they stay online until the operator removes them. Each token can share up to 200 documents of up to 1 MB each.

Shared pages render someone else's Markdown on the same origin as your own documents, so on top of the sanitizer they get a strict Content Security Policy (`apps/web/src/lib/security/shared-page-policy.ts`) and are kept out of search results.

## Project layout

```
apps/
  web/                          the website (Next.js on Vercel)
    src/app/
      page.tsx                  landing page (also sitemap.ts, robots.ts, manifest.ts, opengraph-image.tsx)
      d/page.tsx                opens the last document (or seeds the welcome doc)
      d/[id]/page.tsx           editor workspace
      s/[slug]/page.tsx         read-only view of a shared document
      privacy/, terms/          privacy policy and terms of use
      api/export/pdf/           PDF rendering endpoint
      api/shares/               read, publish, update and unpublish shared documents
    src/lib/
      pdf/                      Chrome launcher, HTML template, URL guard
      share/                    Postgres store, request parsing
      security/                 Content Security Policy for shared pages, CORS for the Mac app
    src/proxy.ts                sends returning visitors from / to their last document; secures shared pages and the API
    public/welcome.md           feature showcase
  desktop/                      the Mac app
    src/app/page.tsx            sidebar and tabbed workspace (static export)
    src-tauri/                  Tauri shell: window, native menu, print, plugins, SQLite document store
packages/
  core/src/                     framework-free logic, shared by both apps
    db.ts                       document storage: Dexie (IndexedDB) on the web, SQLite in the Mac app (store/)
    markdown/                   markdown-it setup and syntax plugins (fence, containers, TOC, source map)
    share/                      owner token, sync client, public copies, share link format
    hooks/                      autosave (use-doc), scroll sync, share status
    tabs.ts, platform.ts        desktop tabs; web vs desktop differences
    preview-dom.ts              DOM diffing (morphdom), Mermaid, copy buttons, static export HTML
    formatting.ts               editor commands behind the formatting bar and its shortcuts
    styles/document.css         document look (preview, print, PDF)
  editor/                       React features: workspace, sidebar, shared document view, desktop tabs
  ui/                           shadcn/ui components, theme switcher, logo, Tailwind theme (globals.css)
  config/                       shared tsconfig bases and ESLint config
```

## License

Andiko is released under the [MIT License](LICENSE), except for the text of the terms of use in `apps/web/src/app/terms/page.tsx`, which is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
