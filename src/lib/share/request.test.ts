// @vitest-environment node
import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"

import { MAX_SHARE_BYTES, MAX_TITLE_LENGTH } from "./protocol"
import { ownerHash, readShareBody } from "./request"

const TOKEN = "Ab3_-".repeat(8) + "xyz"

const withAuth = (authorization?: string) =>
  new Request("http://localhost/api/shares", { headers: authorization ? { authorization } : {} })

const withBody = (body: string) => new Request("http://localhost/api/shares", { method: "POST", body })

describe("ownerHash", () => {
  it("hashes a well-formed bearer token", () => {
    expect(ownerHash(withAuth(`Bearer ${TOKEN}`))).toBe(createHash("sha256").update(TOKEN).digest("hex"))
  })

  it.each([undefined, TOKEN, `Basic ${TOKEN}`, "Bearer short", `Bearer ${TOKEN}!`, `Bearer ${TOKEN}a`])(
    "rejects %s",
    (header) => expect(ownerHash(withAuth(header))).toBeNull(),
  )
})

describe("readShareBody", () => {
  it("reads the title and content", async () => {
    expect(await readShareBody(withBody(JSON.stringify({ title: " Notes ", content: "# Notes" })))).toEqual({
      title: "Notes",
      content: "# Notes",
    })
  })

  it("falls back to Untitled and clamps long titles", async () => {
    expect(await readShareBody(withBody(JSON.stringify({ content: "" })))).toEqual({ title: "Untitled", content: "" })
    const body = await readShareBody(withBody(JSON.stringify({ title: "x".repeat(500), content: "" })))
    expect(body).toMatchObject({ title: "x".repeat(MAX_TITLE_LENGTH) })
  })

  it.each(["not json", "null", JSON.stringify({ title: "No content" }), JSON.stringify({ content: 42 })])(
    "rejects %s with 400",
    async (raw) => {
      const response = await readShareBody(withBody(raw))
      expect(response).toBeInstanceOf(Response)
      expect((response as Response).status).toBe(400)
    },
  )

  it("counts the limit in UTF-8 bytes", async () => {
    // 3 bytes per character
    const content = "€".repeat(Math.floor(MAX_SHARE_BYTES / 3) + 1)
    const response = await readShareBody(withBody(JSON.stringify({ content })))
    expect((response as Response).status).toBe(413)
    expect(await readShareBody(withBody(JSON.stringify({ content: "€".repeat(1000) })))).toMatchObject({ content: "€".repeat(1000) })
  })

  it("rejects an oversized request before reading it", async () => {
    const request = new Request("http://localhost/api/shares", {
      method: "POST",
      headers: { "content-length": String(MAX_SHARE_BYTES * 3) },
      body: "{}",
    })
    expect(((await readShareBody(request)) as Response).status).toBe(413)
  })
})
