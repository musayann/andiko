// @vitest-environment node
import { describe, expect, it } from "vitest"

import { isAllowedUrl, isPrivateAddress } from "./url-guard"

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "flags %s",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  )

  it.each(["8.8.8.8", "140.82.112.3", "2606:4700::6810:85e5"])("allows %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false)
  })
})

describe("isAllowedUrl", () => {
  it.each([
    ["data:image/png;base64,AAAA", true],
    ["about:blank", true],
    ["https://8.8.8.8/logo.png", true],
    ["http://example.com/a.png", false],
    ["file:///etc/passwd", false],
    ["https://127.0.0.1/", false],
    ["https://[::1]/", false],
    ["https://169.254.169.254/latest/meta-data", false],
    ["https://localhost:3000/", false],
    ["https://printer.local/", false],
  ])("%s → %s", async (url, expected) => {
    expect(await isAllowedUrl(url)).toBe(expected)
  })
})
