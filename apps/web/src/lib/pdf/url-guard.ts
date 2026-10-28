import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

function isPrivateIPv4(ip: string) {
  const [a, b] = ip.split(".").map(Number)
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast and reserved
  )
}

function isPrivateIPv6(ip: string) {
  const value = ip.toLowerCase()
  if (value === "::" || value === "::1") return true
  if (/^f[cd]/.test(value) || /^fe[89ab]/.test(value)) return true // unique local, link-local
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(value)
  return mapped ? isPrivateIPv4(mapped[1]) : false
}

/** True for loopback, private, link-local and otherwise non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip)
  if (version === 4) return isPrivateIPv4(ip)
  if (version === 6) return isPrivateIPv6(ip)
  return true
}

/**
 * Decides whether headless Chrome may load a URL while rendering a PDF.
 * The HTML comes from the client, so only public HTTPS resources (and data:
 * URIs) are allowed; this keeps the export route from reaching internal hosts.
 */
export async function isAllowedUrl(raw: string): Promise<boolean> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol === "data:") return true
  if (url.protocol === "about:") return url.href === "about:blank"
  if (url.protocol !== "https:") return false

  const host = url.hostname.replace(/^\[|\]$/g, "")
  if (host === "localhost" || /\.(localhost|local|internal)$/.test(host)) return false
  if (isIP(host)) return !isPrivateAddress(host)

  try {
    const addresses = await lookup(host, { all: true })
    return addresses.length > 0 && addresses.every(({ address }) => !isPrivateAddress(address))
  } catch {
    return false
  }
}
