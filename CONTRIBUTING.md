# Contributing to Andiko

Thanks for your interest in Andiko! Bug reports, ideas, documentation fixes and code are all welcome. This guide covers how to get the project running and what a pull request needs to be merged.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to help

- **Report a bug**: open an [issue](https://github.com/musayann/andiko/issues/new/choose) with steps to reproduce. A small Markdown sample that shows the problem helps a lot.
- **Suggest a feature or ask a question**: start a [Discussion](https://github.com/musayann/andiko/discussions). For larger changes, please discuss the idea there before writing code, so your time isn't spent on something that won't be merged.
- **Pick up an issue**: issues labelled [`good first issue`](https://github.com/musayann/andiko/labels/good%20first%20issue) are a good place to start, and [`help wanted`](https://github.com/musayann/andiko/labels/help%20wanted) marks issues where help is especially welcome. Leave a comment to say you're working on one.
- **Improve the docs**: the [README](README.md) and [`docs/`](docs) can always be clearer.

Security vulnerabilities should **not** be reported in public issues. See [SECURITY.md](SECURITY.md).

## Development setup

### Prerequisites

- **Node 24** (24.22.1 or newer). `.nvmrc` names the version, so `nvm use` picks it up.
- **pnpm 12**. The version is pinned in `package.json` (`packageManager`), so `corepack enable` installs the right one.
- **Rust** (`cargo`), only to build or test the Mac app.
- **Postgres**, optional, only to work on sharing. A local one is enough: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=pg postgres`.

### Getting started

```bash
git clone https://github.com/musayann/andiko.git
cd andiko
pnpm install        # also downloads Chrome for local PDF export (puppeteer)
pnpm dev            # the website, at http://localhost:3000
```

Configuration is optional. Copy `.env.sample` to `.env` at the repo root to enable sharing (`DATABASE_URL`) or to change the other settings it lists. Both apps read it when they start, so restart `pnpm dev` or `pnpm dev:desktop` after changing it; a value in `apps/<app>/.env.local` overrides it for that app only. See [docs/self-hosting.md](docs/self-hosting.md) for every variable.

The first visit seeds a "Welcome" document that shows every supported feature. It's a handy way to check your change against all the Markdown extensions.

### Scripts

The repo is a pnpm workspace run by [Turborepo](https://turborepo.com). The root scripts run the task in every workspace that has it:

| Script               | Purpose                                                   |
| -------------------- | --------------------------------------------------------- |
| `pnpm dev`           | Website development server (Turbopack)                    |
| `pnpm dev:desktop`   | Mac app in development (Tauri, with hot reload)           |
| `pnpm build`         | Production builds of the website and the desktop frontend |
| `pnpm build:desktop` | Mac app bundle (`.app` and `.dmg`)                        |
| `pnpm test`          | Unit tests (Vitest)                                       |
| `pnpm lint`          | ESLint                                                    |
| `pnpm format`        | Format every file with Prettier                           |
| `pnpm typecheck`     | Generate route types and run `tsc`                        |

To run a task in one workspace, filter it, e.g. `pnpm --filter @andiko/core test`.

The Mac app's SQLite store has Rust tests: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`.

### Where things live

Most editor logic is in `packages/core` (framework-free) and `packages/editor` (React), shared by the website (`apps/web`) and the Mac app (`apps/desktop`). [docs/architecture.md](docs/architecture.md) has the full project layout and explains PDF export and sharing.

This project uses **Next.js 16**, which has breaking changes from earlier versions. Before changing Next.js code, check the guides in `node_modules/next/dist/docs/` rather than relying on older documentation (or on an AI assistant's memory of it; see [AGENTS.md](AGENTS.md)).

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Make your change, with tests where it makes sense. Unit tests sit next to the code they test (`*.test.ts`).
3. Run the same checks as CI:

   ```bash
   pnpm lint
   pnpm format:check   # `pnpm format` fixes it
   pnpm typecheck
   pnpm test
   ```

   If you changed `apps/desktop/src-tauri`, also run `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`.

4. Update the docs if you changed behaviour, configuration or scripts.
5. Open a pull request and fill in the template. For UI changes, include a screenshot or a short recording. If your change touches the Mac app, say whether you tested it there.

Every push to `main` builds and publishes a new Mac app release, so pull requests are only merged once CI passes.

### Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, followed by a short summary in the imperative, e.g. `fix: keep scroll sync after resizing the panes`.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
