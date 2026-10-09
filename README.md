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
- **Local-first**: documents live in the browser (IndexedDB). You can import and download `.md` files. There is no account and no backend database.
- **Folders (optional)**: group documents in nested folders. Move them with the ⋯ menu or by dragging in the sidebar. Documents without a folder stay at the top level, as before.

## Getting started

Requires Node 20.9+ and pnpm.

```bash
pnpm install        # also downloads Chrome for local PDF export (puppeteer)
pnpm dev            # http://localhost:3000
```

The first visit seeds a "Welcome" document that shows every supported feature.

| Script           | Purpose                           |
| ---------------- | --------------------------------- |
| `pnpm dev`       | Development server (Turbopack)    |
| `pnpm build`     | Production build                  |
| `pnpm test`      | Unit tests (Vitest)               |
| `pnpm lint`      | ESLint                            |
| `pnpm typecheck` | Generate route types and run `tsc` |

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

## Project layout

```
src/
  app/
    page.tsx                  opens the last document (or seeds the welcome doc)
    d/[id]/page.tsx           editor workspace
    api/export/pdf/route.ts   PDF rendering endpoint
  components/
    app-sidebar.tsx           document list, import, duplicate, download, delete
    sidebar/                  folder tree rows, Move to menu, folder dialogs, drag and drop
    workspace/                toolbar, formatting bar, CodeMirror editor, preview, TOC, export dialog
  hooks/                      autosave (use-doc), scroll sync
  lib/
    markdown/                 markdown-it setup and syntax plugins (fence, containers, TOC, source map)
    preview-dom.ts            DOM diffing (morphdom), Mermaid, copy buttons, static export HTML
    formatting.ts             editor commands behind the formatting bar and its shortcuts
    scroll-sync.ts            editor line ↔ preview offset mapping
    db.ts                     Dexie (IndexedDB) storage
    folders.ts                folder tree helpers (nesting, cycle checks, paths)
    pdf/                      Chrome launcher, HTML template, URL guard
  styles/document.css         document look (preview, print, PDF)
public/welcome.md             feature showcase
```

## License

Andiko is released under the [MIT License](https://opensource.org/licenses/MIT).
