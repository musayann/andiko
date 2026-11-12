# Architecture

Andiko is a pnpm workspace run by [Turborepo](https://turborepo.com): two apps (the website and the Mac app) built from shared packages. Documents are stored on the user's device; the server only renders PDFs and hosts the documents someone chooses to share.

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

## PDF export

`POST /api/export/pdf` receives the rendered document HTML from the client. It loads it into headless Chrome with the same stylesheet as the preview (`packages/core/src/styles/document.css`) and returns the PDF. Mermaid diagrams are rendered in the browser first. Which Chrome it launches depends on the environment: see [Self-hosting → PDF export](self-hosting.md#pdf-export).

### Security

The export HTML comes from the client, so the route treats it as untrusted:

- JavaScript is disabled in the page, and a CSP only allows inline styles and `https:`/`data:` images.
- Every request is checked. Only public `https:` hosts and `data:` URIs are allowed. Localhost, private, link-local and metadata IPs are blocked after DNS resolution.
- Request bodies are capped at 5 MB.

## Sharing

Share publishes a read-only link at `/s/<title>-<id>`. Only the id identifies the document: links made before a title change, or with a bare id, redirect to the current title. Later edits sync to it automatically, and only the browser that published it can edit or unpublish it (the instance's operator can still remove it). Visitors can save their own editable copy, which never touches the original.

There are no accounts. The first time the editor opens, the browser gets a random owner token, kept in localStorage. The server stores only its SHA-256 hash next to each shared document, and only requests carrying that token can update or unpublish it. Clearing site data loses the token, so the browser can no longer change its shared documents; they stay online until the operator removes them. Each token can share up to 200 documents of up to 1 MB each.

Shared pages render someone else's Markdown on the same origin as your own documents, so on top of the sanitizer they get a strict Content Security Policy (`apps/web/src/lib/security/shared-page-policy.ts`) and are kept out of search results.
