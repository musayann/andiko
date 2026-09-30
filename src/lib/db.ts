import Dexie, { type EntityTable } from "dexie"
import { nanoid } from "nanoid"

import { getDocTitle } from "./title"

export interface Doc {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

const db = new Dexie("andiko") as Dexie & { docs: EntityTable<Doc, "id"> }

db.version(1).stores({ docs: "id, updatedAt" })

export { db }

const LAST_DOC_KEY = "andiko:last-doc"

export async function createDoc(content = ""): Promise<string> {
  const now = Date.now()
  const id = nanoid(10)
  await db.docs.add({ id, title: getDocTitle(content), content, createdAt: now, updatedAt: now })
  return id
}

export async function saveDocContent(id: string, content: string) {
  await db.docs.update(id, { content, title: getDocTitle(content), updatedAt: Date.now() })
}

export async function duplicateDoc(id: string): Promise<string | undefined> {
  const doc = await db.docs.get(id)
  return doc ? createDoc(doc.content) : undefined
}

export async function deleteDoc(id: string) {
  await db.docs.delete(id)
}

export function getLastDocId(): string | null {
  try {
    return localStorage.getItem(LAST_DOC_KEY)
  } catch {
    return null
  }
}

export function setLastDocId(id: string) {
  try {
    localStorage.setItem(LAST_DOC_KEY, id)
  } catch {
    // storage unavailable (private mode); not critical
  }
}

let startDoc: Promise<string> | null = null

/** Resolves the doc to open on start: last opened, else most recent, else a new welcome doc. */
export function resolveStartDoc(): Promise<string> {
  // shared so a double-invoked effect (React strict mode) can't seed two welcome docs
  startDoc ??= findStartDoc().finally(() => {
    startDoc = null
  })
  return startDoc
}

async function findStartDoc(): Promise<string> {
  const last = getLastDocId()
  if (last && (await db.docs.get(last))) return last

  const recent = await db.docs.orderBy("updatedAt").last()
  if (recent) return recent.id

  let welcome = ""
  try {
    const res = await fetch("/welcome.md")
    if (res.ok) welcome = await res.text()
  } catch {
    // offline: start with an empty document
  }
  return createDoc(welcome)
}
