# Mac app

`apps/desktop` wraps the editor in [Tauri](https://tauri.app). Its frontend is a static export of the same components as the website, loaded from disk, so documents stay on the Mac and editing works offline.

## Install

Download the universal `.dmg` (Apple Silicon and Intel) from the [latest release](https://github.com/musayann/andiko/releases/latest).

The app is ad-hoc signed, not notarized: on first launch, allow it in System Settings → Privacy & Security → Open Anyway (or run `xattr -dr com.apple.quarantine /Applications/Andiko.app`).

After that the app updates itself: it checks the latest release's `latest.json` at launch and every few hours (or from Andiko → Check for Updates…), installs a newer version in the background and offers to restart.

## Where documents live

Documents are kept in a SQLite database at `~/Library/Application Support/app.andiko.desktop/andiko.db`, where Time Machine backs them up, together with the open tabs and the key to your published documents (`pnpm dev:desktop` uses `andiko-dev.db` next to it). On first launch, the app moves in what earlier versions kept in WebKit's storage.

## Tabs and links

Documents open in tabs:

| Shortcut                              | Action                      |
| ------------------------------------- | --------------------------- |
| <kbd>⌘</kbd><kbd>T</kbd>              | New tab                     |
| <kbd>⌘</kbd><kbd>W</kbd>              | Close tab                   |
| <kbd>⌘</kbd><kbd>1</kbd>–<kbd>9</kbd> | Switch to tab               |
| <kbd>⌘</kbd><kbd>L</kbd>              | Open a shared link in a tab |

Links to the site in a document open in a tab too, and the app handles the `andiko://` scheme: `andiko://s/<slug>-<id>` opens what `https://andiko.app/s/<slug>-<id>` shows (macOS registers it when the app is installed, so it doesn't reach `pnpm dev:desktop`).

## The website it talks to

Sharing and the PDF fallback call the website's API at `NEXT_PUBLIC_SITE_URL`; PDF export otherwise uses the system print dialog. Its Help menu opens that site, the project's GitHub issues, and the site's privacy policy and terms of use (Help → Privacy Policy); its Report link on shared documents writes to `NEXT_PUBLIC_CONTACT_EMAIL`, which the release build reads from the repo's Actions variable of the same name.

`pnpm dev:desktop` and local builds read both from the root `.env`; the app's CSP only allows `https://andiko.app`, so keep any other `NEXT_PUBLIC_SITE_URL` in `apps/web/.env.local`.

## Building

Building the app needs Rust (`cargo`) on top of the Node toolchain in [CONTRIBUTING.md](../CONTRIBUTING.md).

```bash
pnpm dev:desktop     # development, with hot reload
pnpm build:desktop   # .app and .dmg
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml   # SQLite store tests
```

## Releases

Every push to `main` is released: the [Desktop macOS build](../.github/workflows/desktop-macos.yml) workflow publishes a universal `.dmg` to [Releases](https://github.com/musayann/andiko/releases), versioned `<major.minor>.<run number>` from `apps/desktop/package.json`. It runs CI first, so a failing check blocks the release.

Updates are signed with a key kept in the repo's `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secrets, whose public half is `plugins.updater.pubkey` in `tauri.conf.json`; installed apps only accept updates signed with it, so losing the key means they can't update again.

## App icon

The app icon is drawn in Icon Composer (`apps/desktop/src-tauri/icons/andiko.icon`), but builds use the `Assets.car` compiled from it next to it, because `actool` in some Xcode 26 releases crashes on `.icon` files. After changing the icon, run `pnpm --filter @andiko/desktop icon:car` and commit the new `Assets.car`.
