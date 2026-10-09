import { nanoid } from "nanoid"
import postgres from "postgres"

// Server only: published documents in Postgres. Everything else stays in the
// visitor's browser, so this is the app's only server-side storage.

export interface Share {
  id: string
  title: string
  content: string
  updatedAt: Date
}

export interface ShareBody {
  title: string
  content: string
}

/** "forbidden": the document exists but belongs to another owner token. */
export type WriteResult = "ok" | "forbidden" | "missing"

/** Most documents one owner token can publish, so a single client can't fill the database. */
export const MAX_SHARES_PER_OWNER = 200

// Created on first use, so a fresh database needs no setup step.
// owner_hash is the SHA-256 of the owner's token; the token itself is never stored.
const SCHEMA = [
  `create table if not exists shares (
    id text primary key,
    owner_hash text not null,
    title text not null,
    content text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  "create index if not exists shares_owner_hash_idx on shares (owner_hash)",
]

type Sql = ReturnType<typeof postgres>

// kept on globalThis so dev hot reloads reuse the connection pool
const cached = globalThis as typeof globalThis & { andikoSql?: Sql; andikoSchema?: Promise<void> }

export const sharingEnabled = () => Boolean(process.env.DATABASE_URL)

async function connect(): Promise<Sql> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  // no prepared statements: transaction-mode poolers (Neon, Supabase) don't support them
  const sql = (cached.andikoSql ??= postgres(url, { prepare: false, onnotice: () => {} }))
  cached.andikoSchema ??= (async () => {
    for (const statement of SCHEMA) await sql.unsafe(statement)
  })().catch((error) => {
    cached.andikoSchema = undefined
    throw error
  })
  await cached.andikoSchema
  return sql
}

export async function getShare(id: string): Promise<Share | null> {
  const sql = await connect()
  const [row] = await sql<Share[]>`
    select id, title, content, updated_at as "updatedAt" from shares where id = ${id}
  `
  return row ?? null
}

/** Returns the new public id, or null when the owner has reached MAX_SHARES_PER_OWNER. */
export async function createShare(ownerHash: string, { title, content }: ShareBody): Promise<string | null> {
  const sql = await connect()
  const id = nanoid(12)
  const rows = await sql`
    insert into shares (id, owner_hash, title, content)
    select ${id}, ${ownerHash}, ${title}, ${content}
    where (select count(*) from shares where owner_hash = ${ownerHash}) < ${MAX_SHARES_PER_OWNER}
    returning id
  `
  return rows.length ? id : null
}

export async function updateShare(id: string, ownerHash: string, { title, content }: ShareBody): Promise<WriteResult> {
  const sql = await connect()
  const rows = await sql`
    update shares set title = ${title}, content = ${content}, updated_at = now()
    where id = ${id} and owner_hash = ${ownerHash}
    returning id
  `
  return rows.length ? "ok" : whyNotWritten(sql, id)
}

export async function deleteShare(id: string, ownerHash: string): Promise<WriteResult> {
  const sql = await connect()
  const rows = await sql`delete from shares where id = ${id} and owner_hash = ${ownerHash} returning id`
  return rows.length ? "ok" : whyNotWritten(sql, id)
}

async function whyNotWritten(sql: Sql, id: string): Promise<WriteResult> {
  const rows = await sql`select 1 from shares where id = ${id}`
  return rows.length ? "forbidden" : "missing"
}
