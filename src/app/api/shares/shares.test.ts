// @vitest-environment node
import { createHash } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createShare, deleteShare, sharingEnabled, updateShare } from "@/lib/share/store"

import { DELETE, PUT } from "./[id]/route"
import { POST } from "./route"

vi.mock("@/lib/share/store", () => ({
  MAX_SHARES_PER_OWNER: 200,
  sharingEnabled: vi.fn(),
  createShare: vi.fn(),
  updateShare: vi.fn(),
  deleteShare: vi.fn(),
}))

const TOKEN = "a".repeat(43)
const OWNER = createHash("sha256").update(TOKEN).digest("hex")
const ID = "abcdefghijkl"
const DOC = { title: "Notes", content: "# Notes" }

function request(method: string, { token = TOKEN, body }: { token?: string | null; body?: unknown } = {}) {
  return new Request("http://localhost/api/shares", {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const params = (id = ID) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(sharingEnabled).mockReturnValue(true)
  vi.mocked(createShare).mockResolvedValue(ID)
  vi.mocked(updateShare).mockResolvedValue("ok")
  vi.mocked(deleteShare).mockResolvedValue("ok")
})

describe("POST /api/shares", () => {
  it("publishes under the token's hash and returns the public id", async () => {
    const response = await POST(request("POST", { body: DOC }))
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ id: ID })
    expect(createShare).toHaveBeenCalledWith(OWNER, DOC)
  })

  it("requires an owner token", async () => {
    expect((await POST(request("POST", { token: null, body: DOC }))).status).toBe(401)
    expect((await POST(request("POST", { token: "too-short", body: DOC }))).status).toBe(401)
    expect(createShare).not.toHaveBeenCalled()
  })

  it("rejects documents over the limit", async () => {
    const response = await POST(request("POST", { body: { content: "x".repeat(1024 * 1024 + 1) } }))
    expect(response.status).toBe(413)
  })

  it("reports the per-owner limit", async () => {
    vi.mocked(createShare).mockResolvedValue(null)
    expect((await POST(request("POST", { body: DOC }))).status).toBe(429)
  })

  it("is unavailable without a database", async () => {
    vi.mocked(sharingEnabled).mockReturnValue(false)
    expect((await POST(request("POST", { body: DOC }))).status).toBe(503)
  })
})

describe("PUT /api/shares/[id]", () => {
  it("updates the owner's document", async () => {
    expect((await PUT(request("PUT", { body: DOC }), params())).status).toBe(204)
    expect(updateShare).toHaveBeenCalledWith(ID, OWNER, DOC)
  })

  it("refuses other tokens", async () => {
    vi.mocked(updateShare).mockResolvedValue("forbidden")
    expect((await PUT(request("PUT", { body: DOC }), params())).status).toBe(403)
  })

  it("reports unknown and malformed ids as not found", async () => {
    vi.mocked(updateShare).mockResolvedValue("missing")
    expect((await PUT(request("PUT", { body: DOC }), params())).status).toBe(404)
    expect((await PUT(request("PUT", { body: DOC }), params("../etc"))).status).toBe(404)
    expect(updateShare).toHaveBeenCalledTimes(1)
  })

  it("requires an owner token", async () => {
    expect((await PUT(request("PUT", { token: null, body: DOC }), params())).status).toBe(401)
    expect(updateShare).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/shares/[id]", () => {
  it("unpublishes the owner's document", async () => {
    expect((await DELETE(request("DELETE"), params())).status).toBe(204)
    expect(deleteShare).toHaveBeenCalledWith(ID, OWNER)
  })

  it("refuses other tokens and missing tokens", async () => {
    vi.mocked(deleteShare).mockResolvedValue("forbidden")
    expect((await DELETE(request("DELETE"), params())).status).toBe(403)
    expect((await DELETE(request("DELETE", { token: null }), params())).status).toBe(401)
  })
})
