// @vitest-environment node
import postgres from "postgres"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createShare, deleteShare, getShare, MAX_SHARES_PER_OWNER, sharingEnabled, updateShare } from "./store"

// A stand-in for postgres: it records each query, with $n in place of its parameters,
// and answers with the next entry of db.results (no rows once they run out).
const db = vi.hoisted(() => {
  const db = {
    queries: [] as { text: string; params: unknown[] }[],
    results: [] as unknown[][],
    sql: Object.assign(
      async (strings: TemplateStringsArray, ...params: unknown[]) => {
        const text = strings.reduce((text, part, i) => `${text}$${i}${part}`)
        db.queries.push({ text: text.replace(/\s+/g, " ").trim(), params })
        return db.results.shift() ?? []
      },
      { unsafe: vi.fn<(statement: string) => Promise<unknown[]>>(async () => []) },
    ),
  }
  return db
})

vi.mock("postgres", () => ({ default: vi.fn(() => db.sql) }))

const DATABASE_URL = "postgres://localhost/andiko"
const ID = "abcdefghijkl"
const OWNER = "a".repeat(64)
const OTHER = "b".repeat(64)
const DOC = { title: "Notes", content: "# Notes" }

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", DATABASE_URL)
  db.queries = []
  db.results = []
  // the store keeps its connection on globalThis, so it survives dev hot reloads
  const cached = globalThis as { andikoSql?: unknown; andikoSchema?: unknown }
  delete cached.andikoSql
  delete cached.andikoSchema
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe("share store", () => {
  it("is enabled by DATABASE_URL", async () => {
    expect(sharingEnabled()).toBe(true)
    vi.stubEnv("DATABASE_URL", "")
    expect(sharingEnabled()).toBe(false)
    await expect(getShare(ID)).rejects.toThrow("DATABASE_URL is not set")
  })

  it("connects without prepared statements and creates its table once, on first use", async () => {
    await getShare(ID)
    await getShare(ID)
    expect(postgres).toHaveBeenCalledOnce()
    expect(postgres).toHaveBeenCalledWith(DATABASE_URL, expect.objectContaining({ prepare: false }))
    expect(db.sql.unsafe).toHaveBeenCalledTimes(2)
    expect(db.sql.unsafe).toHaveBeenNthCalledWith(1, expect.stringContaining("create table if not exists shares"))
  })

  it("tries creating its table again after a failure", async () => {
    db.sql.unsafe.mockRejectedValueOnce(new Error("connection refused"))
    await expect(getShare(ID)).rejects.toThrow("connection refused")
    expect(await getShare(ID)).toBeNull()
    expect(db.sql.unsafe).toHaveBeenCalledTimes(3)
  })

  it("reads a document by its id", async () => {
    const share = { id: ID, ...DOC, updatedAt: new Date() }
    db.results = [[share]]
    expect(await getShare(ID)).toEqual(share)
    expect(db.queries).toEqual([{ text: expect.stringContaining("from shares where id = $1"), params: [ID] }])
  })

  it("finds nothing for an unknown id", async () => {
    expect(await getShare(ID)).toBeNull()
  })

  it("publishes a document under its owner's hash, up to a limit", async () => {
    db.results = [[{}]]
    const id = await createShare(OWNER, DOC)
    expect(id).toMatch(/^[\w-]{12}$/)
    const [{ text, params }] = db.queries
    expect(text).toContain("insert into shares (id, owner_hash, title, content) select $1, $2, $3, $4")
    expect(text).toContain("where (select count(*) from shares where owner_hash = $5) < $6")
    expect(params).toEqual([id, OWNER, DOC.title, DOC.content, OWNER, MAX_SHARES_PER_OWNER])

    // nothing inserted: the owner has reached the limit
    expect(await createShare(OWNER, DOC)).toBeNull()
  })

  it("updates a document for its owner only", async () => {
    db.results = [[{}]]
    expect(await updateShare(ID, OWNER, DOC)).toBe("ok")
    expect(db.queries).toEqual([
      {
        text: expect.stringContaining("updated_at = now() where id = $3 and owner_hash = $4"),
        params: [DOC.title, DOC.content, ID, OWNER],
      },
    ])

    db.results = [[], [{}]]
    expect(await updateShare(ID, OTHER, DOC)).toBe("forbidden")
    expect(db.queries.at(-1)).toEqual({ text: "select 1 from shares where id = $1", params: [ID] })
    expect(await updateShare(ID, OWNER, DOC)).toBe("missing")
  })

  it("deletes a document for its owner only", async () => {
    db.results = [[{}]]
    expect(await deleteShare(ID, OWNER)).toBe("ok")
    expect(db.queries).toEqual([
      { text: "delete from shares where id = $1 and owner_hash = $2 returning id", params: [ID, OWNER] },
    ])

    db.results = [[], [{}]]
    expect(await deleteShare(ID, OTHER)).toBe("forbidden")
    expect(db.queries.at(-1)).toEqual({ text: "select 1 from shares where id = $1", params: [ID] })
    expect(await deleteShare(ID, OWNER)).toBe("missing")
  })
})
