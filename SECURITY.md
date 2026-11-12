# Security policy

## Supported versions

| Version                            | Supported                                          |
| ---------------------------------- | -------------------------------------------------- |
| The website on `main` (andiko.app) | Yes                                                |
| The latest Mac app release         | Yes                                                |
| Older Mac app releases             | No: the app updates itself, so please update first |

## Reporting a vulnerability

**Please don't report security vulnerabilities in public issues, discussions or pull requests.**

Report them privately through GitHub: [**Report a vulnerability**](https://github.com/musayann/andiko/security/advisories/new). Only the maintainer can see the report, and we can work on the fix together in the advisory.

Please include:

- what the vulnerability is and what an attacker could do with it
- where it is: the website, the Mac app, or both, and the version or commit
- steps to reproduce, or a proof of concept
- any ideas you have for a fix

The maintainer aims to acknowledge reports within 7 days and to keep you updated until the issue is fixed. Once a fix is released, the advisory is published, crediting you unless you'd rather stay anonymous.

## Scope

Particularly interesting areas:

- **Sharing**: the `/api/shares` routes and owner tokens, e.g. editing or unpublishing someone else's document
- **Shared pages**: escaping the Markdown sanitizer or the shared-page Content Security Policy (XSS)
- **PDF export**: bypassing the URL guard to reach internal hosts (SSRF), or running script in the rendering browser
- **Mac app**: the auto-updater, the `andiko://` scheme, or reaching files outside the app's own data

[docs/architecture.md](docs/architecture.md) describes how sharing and PDF export defend against these.

Out of scope:

- instances run by someone else on their own domain, when the problem comes from their configuration rather than this code
- attacks that need an already compromised device or browser
- missing security headers or best practices without a demonstrated impact
