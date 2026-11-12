# Self-hosting

Andiko's website (`apps/web`) is a Next.js app. It runs on Vercel out of the box and anywhere else Node and Chrome run. Every setting is optional: without any, you get the editor, local storage and PDF export, and the Share button stays hidden.

## Configuration

[`.env.sample`](../.env.sample) at the repo root lists every variable with a comment explaining it. For local development, copy it to `.env` at the repo root. Both apps read it when they start, so restart `pnpm dev` or `pnpm dev:desktop` after changing it; a value in `apps/<app>/.env.local` overrides it for that app only. It's for local development: deployments and the release workflow set their own variables.

`NEXT_PUBLIC_*` values are baked in at build time, so rebuild after changing them.

| Variable                                                                                         | When    | Purpose                                                                   |
| ------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                                   | runtime | Postgres for shared documents. Unset hides the Share button.              |
| `NEXT_PUBLIC_SITE_URL`                                                                           | build   | Public origin for canonical links, the sitemap, `robots.txt` and OG cards |
| `NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_DATABASE_REGION`          | build   | Who runs the instance; publishes `/privacy` and `/terms`                  |
| `NEXT_PUBLIC_OPERATOR_ADDRESS`, `NEXT_PUBLIC_OPERATOR_REGISTRATION`, `NEXT_PUBLIC_SERVER_REGION` | build   | Optional details for the privacy policy and terms                         |
| `CHROME_EXECUTABLE_PATH`                                                                         | runtime | Chrome binary for PDF export, e.g. in Docker                              |

## Domain

Canonical links, the sitemap, `robots.txt` and Open Graph images use `https://andiko.app`. If you self-host on another domain, set `NEXT_PUBLIC_SITE_URL` to its origin (e.g. `https://notes.example.com`).

## Sharing

Sharing needs a Postgres database. Set `DATABASE_URL` (for example Neon or Supabase on Vercel, or `postgres://postgres:pg@localhost:5432/postgres` after `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=pg postgres`). The `shares` table is created on first use. Without `DATABASE_URL` the Share button is hidden and everything else works as before.

See [Architecture → Sharing](architecture.md#sharing) for how ownership and limits work.

## Privacy policy and terms

The privacy policy (`/privacy`) and terms (`/terms`) name whoever runs the instance, so they are only published when `NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_CONTACT_EMAIL` and `NEXT_PUBLIC_DATABASE_REGION` are set; the root `.env.sample` lists the optional details. The contact email also adds a Report link to shared pages. The policy names Vercel and Neon as providers, and both pages describe the Mac app released from this repo, so edit `apps/web/src/app/privacy/page.tsx` and `apps/web/src/app/terms/page.tsx` if you host elsewhere or don't ship the app.

## Vercel

On Vercel, set the project's Root Directory to `apps/web`.

## PDF export

`POST /api/export/pdf` renders PDFs in headless Chrome. The route picks a Chrome in this order:

| Environment                     | Chrome used                                                    |
| ------------------------------- | -------------------------------------------------------------- |
| Vercel / AWS Lambda             | [`@sparticuz/chromium`](https://github.com/Sparticuz/chromium) |
| `CHROME_EXECUTABLE_PATH` is set | That binary (e.g. `/usr/bin/chromium` in Docker)               |
| Local development               | The Chrome downloaded by the `puppeteer` dev dependency        |

For Docker or other self-hosting, install Chromium in the image and set `CHROME_EXECUTABLE_PATH`. Serverless Chromium ships with few system fonts, so emoji and CJK text may need extra fonts (see `chromium.font()` in the sparticuz docs).

See [Architecture → PDF export](architecture.md#pdf-export) for how the route treats untrusted input.

## Landing page

`/` is a static landing page for new visitors and search engines. Once someone has opened a document, a cookie makes `/` redirect them to `/d`, which reopens their last document.
