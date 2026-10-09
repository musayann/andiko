import { TOKEN_PATTERN } from "./protocol"

// The owner token proves that this browser published a document: the server
// keeps only its hash and accepts changes from requests that carry it. There is
// no account, so losing it (clearing site data) means the published copies can
// no longer be updated from here.
const TOKEN_KEY = "andiko:owner-token"

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

/** This browser's owner token, created on first use. Null when storage is unavailable. */
export function getOwnerToken(): string | null {
  try {
    let token = localStorage.getItem(TOKEN_KEY)
    // a malformed token can't have published anything, so replacing it loses nothing
    if (!token || !TOKEN_PATTERN.test(token)) {
      token = newToken()
      localStorage.setItem(TOKEN_KEY, token)
    }
    return token
  } catch {
    return null
  }
}
