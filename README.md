<img src="src/app/icon.svg" width="64" height="64" alt="Andiko logo">

# Andiko

A local-first Markdown editor with live preview and PDF export. Built with Next.js, shadcn/ui, CodeMirror and markdown-it.

- **Edit / Split / View**: write on one side and read on the other, or hide either side (<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>E</kbd> / <kbd>B</kbd> / <kbd>V</kbd>). Drag the divider to resize. The panes stay scroll-synced.
- **Formatting bar**: buttons above the editor for headings, bold, italic, strikethrough, highlight, inline code, sub/superscript, quotes, lists, task lists, links, images, tables (pick a size from a grid), code blocks and dividers. An Insert menu adds alert boxes, spoilers, math blocks and Mermaid diagrams. Shortcuts: <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>B</kbd> bold, <kbd>I</kbd> italic, <kbd>Shift</kbd>+<kbd>X</kbd> strikethrough, <kbd>E</kbd> inline code, <kbd>K</kbd> link.
- **Extended Markdown**:
  - alert boxes (`:::info`, `:::success`, `:::warning`, `:::danger`) and `:::spoiler`
  - `[TOC]`, KaTeX math (`$…$`, `$$…$$`) and Mermaid diagrams
  - code blocks with line numbers (`` ```js= ``, `=101`, `=+`) and wrapping (`!`)
  - task lists you can click in the preview
  - footnotes, definition lists, abbreviations, `==mark==`, `++ins++`, `~sub~`, `^sup^` and emoji shortcodes
  - YAML front matter (`title`, `tags`, `breaks`)
- **PDF export**: a real download rendered by headless Chrome on the server, with selectable text, embedded fonts and page numbers. Browser printing is available as a fallback.
- **Local-first**: documents live in the browser (IndexedDB). You can import and download `.md` files. There is no account, and only documents you share are stored on the server.
- **Sharing**: Share publishes a read-only link at `/s/<title>-<id>`. Only the id identifies the document: links made before a title change, or with a bare id, redirect to the current title. Your later edits sync to it automatically, and only your browser can edit or unpublish it (the instance's operator can still remove it). Visitors can save their own editable copy, which never touches the original.
- **Folders (optional)**: group documents in nested folders. Move them with the ⋯ menu or by dragging in the sidebar. Documents without a folder stay at the top level, as before.

## Getting started

Requires Node 20.9+ and pnpm.

```bash
pnpm install        # also downloads Chrome for local PDF export (puppeteer)
pnpm dev            # http://localhost:3000
```

Configuration is optional. Copy `.env.sample` to `.env.local` to enable sharing (`DATABASE_URL`) or to change the other settings it lists.

The first visit seeds a "Welcome" document that shows every supported feature.

| Script           | Purpose                           |
| ---------------- | --------------------------------- |
| `pnpm dev`       | Development server (Turbopack)    |
| `pnpm build`     | Production build                  |
| `pnpm test`      | Unit tests (Vitest)               |
| `pnpm lint`      | ESLint                            |
| `pnpm typecheck` | Generate route types and run `tsc` |

## Deployment

Canonical links, the sitemap, `robots.txt` and Open Graph images use `https://andiko.app`. If you self-host on another domain, set `NEXT_PUBLIC_SITE_URL` to its origin (e.g. `https://notes.example.com`).

Sharing needs a Postgres database. Set `DATABASE_URL` (for example Neon or Supabase on Vercel, or `postgres://postgres:pg@localhost:5432/postgres` after `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=pg postgres`). The `shares` table is created on first use. Without `DATABASE_URL` the Share button is hidden and everything else works as before.

The privacy policy (`/privacy`) and terms (`/terms`) name whoever runs the instance, so they are only published when `NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_CONTACT_EMAIL` and `NEXT_PUBLIC_DATABASE_REGION` are set; `.env.sample` lists the optional details. The contact email also adds a Report link to shared pages. The policy names Vercel and Neon as providers, so edit `src/app/privacy/page.tsx` if you host elsewhere.

`/` is a static landing page for new visitors and search engines. Once someone has opened a document, a cookie makes `/` redirect them to `/d`, which reopens their last document.

## PDF export

`POST /api/export/pdf` receives the rendered document HTML from the client. It loads it into headless Chrome with the same stylesheet as the preview (`src/styles/document.css`) and returns the PDF. Mermaid diagrams are rendered in the browser first.

The route picks a Chrome in this order:

| Environment                         | Chrome used                                                      |
| ----------------------------------- | ---------------------------------------------------------------- |
| Vercel / AWS Lambda                 | [`@sparticuz/chromium`](https://github.com/Sparticuz/chromium)   |
| `CHROME_EXECUTABLE_PATH` is set     | That binary (e.g. `/usr/bin/chromium` in Docker)                  |
| Local development                   | The Chrome downloaded by the `puppeteer` dev dependency          |

For Docker or other self-hosting, install Chromium in the image and set `CHROME_EXECUTABLE_PATH`. Serverless Chromium ships with few system fonts, so emoji and CJK text may need extra fonts (see `chromium.font()` in the sparticuz docs).

### Security

The export HTML comes from the client, so the route treats it as untrusted:

- JavaScript is disabled in the page, and a CSP only allows inline styles and `https:`/`data:` images.
- Every request is checked. Only public `https:` hosts and `data:` URIs are allowed. Localhost, private, link-local and metadata IPs are blocked after DNS resolution.
- Request bodies are capped at 5 MB.

## Sharing

There are no accounts. The first time the editor opens, the browser gets a random owner token, kept in localStorage. The server stores only its SHA-256 hash next to each shared document, and only requests carrying that token can update or unpublish it. Clearing site data loses the token, so the browser can no longer change its shared documents; they stay online until the operator removes them. Each token can share up to 200 documents of up to 1 MB each.

Shared pages render someone else's Markdown on the same origin as your own documents, so on top of the sanitizer they get a strict Content Security Policy (`src/lib/security/shared-page-policy.ts`) and are kept out of search results.

## Project layout

```
src/
  app/
    page.tsx                  landing page (also sitemap.ts, robots.ts, manifest.ts, opengraph-image.tsx)
    d/page.tsx                opens the last document (or seeds the welcome doc)
    d/[id]/page.tsx           editor workspace
    s/[slug]/page.tsx         read-only view of a shared document
    privacy/page.tsx          privacy policy
    terms/page.tsx            terms of use
    api/export/pdf/route.ts   PDF rendering endpoint
    api/shares/               publish, update and unpublish shared documents
  components/
    app-sidebar.tsx           document list, import, duplicate, download, delete
    share-sync.tsx            pushes edits of shared documents to their public copies
    shared/                   the shared document viewer
    sidebar/                  folder tree rows, Move to menu, folder dialogs, drag and drop
    workspace/                toolbar, formatting bar, CodeMirror editor, preview, TOC, export and share dialogs
  hooks/                      autosave (use-doc), scroll sync
  lib/
    markdown/                 markdown-it setup and syntax plugins (fence, containers, TOC, source map)
    preview-dom.ts            DOM diffing (morphdom), Mermaid, copy buttons, static export HTML
    formatting.ts             editor commands behind the formatting bar and its shortcuts
    scroll-sync.ts            editor line ↔ preview offset mapping
    db.ts                     Dexie (IndexedDB) storage
    folders.ts                folder tree helpers (nesting, cycle checks, paths)
    pdf/                      Chrome launcher, HTML template, URL guard
    share/                    owner token, sync client, Postgres store, request parsing
    security/                 Content Security Policy for shared pages
  styles/document.css         document look (preview, print, PDF)
  proxy.ts                    sends returning visitors from / to their last document; secures shared pages
public/welcome.md             feature showcase
```

## License

Andiko is released under the [MIT License](LICENSE), except for the text of the terms of use in `src/app/terms/page.tsx`, which is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
