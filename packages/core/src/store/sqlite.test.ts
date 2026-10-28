import { act, renderHook, waitFor } from "@testing-library/react"
import Dexie from "dexie"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { describeStoreContract, doc, folder } from "./contract"
import type { Store } from "./model"

interface WriteOp {
  table: string
  id: string
  value: unknown
}

// Stands in for apps/desktop/src-tauri/src/store.rs: rows are kept as JSON text, a
// batch of writes applies all or not at all, and a null value deletes the row.
// Hoisted so it outlives vi.resetModules(), like the file outlives an app restart.
const backend = vi.hoisted(() => {
  const tables = new Map<string, Map<string, string>>()
  const rows = (table: string) => {
    if (!tables.has(table)) tables.set(table, new Map())
    return tables.get(table)!
  }
  const parsed = (table: string) => [...rows(table).values()].map((text) => JSON.parse(text) as unknown)
  // what crosses the IPC bridge is serialized, so undefined fields are dropped
  const roundTrip = <T>(value: T): T => (value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T))

  let writes: WriteOp[][] = []
  let loads = 0
  let failures: Record<string, number> = {}
  let gates: Record<string, Promise<void> | undefined> = {}

  async function run(command: string, args: Record<string, unknown>) {
    if (failures[command]) {
      failures[command]--
      throw `${command} failed`
    }
    switch (command) {
      case "store_load":
        loads++
        return {
          docs: parsed("docs"),
          folders: parsed("folders"),
          publicCopies: parsed("publicCopies"),
          settings: Object.fromEntries([...rows("settings")].map(([id, text]) => [id, JSON.parse(text) as unknown])),
        }
      case "store_get": {
        const text = rows(args.table as string).get(args.id as string)
        return text === undefined ? null : JSON.parse(text)
      }
      case "store_write":
        for (const { table, id, value } of args.ops as WriteOp[]) {
          if (value === null) rows(table).delete(id)
          else rows(table).set(id, JSON.stringify(value))
        }
        return null
      default:
        throw `unknown command ${command}`
    }
  }

  return {
    invoke: vi.fn(async (command: string, args: Record<string, unknown> = {}) => {
      args = roundTrip(args)
      if (command === "store_write") writes.push(args.ops as WriteOp[])
      await gates[command]
      return roundTrip(await run(command, args))
    }),
    reset() {
      tables.clear()
      writes = []
      loads = 0
      failures = {}
      gates = {}
    },
    /** Every store_write received, in order, including failed ones. */
    get writes() {
      return writes
    },
    get loads() {
      return loads
    },
    rows,
    /** Puts rows in the file directly. */
    seed(table: string, ...values: { id: string }[]) {
      for (const value of values) rows(table).set(value.id, JSON.stringify(value))
    },
    /** Makes the next `count` calls of `command` fail without changing anything. */
    fail(command: string, count = 1) {
      failures[command] = count
    },
    /** Holds calls of `command` until the returned function is called. */
    hold(command: string) {
      let release!: () => void
      gates[command] = new Promise((resolve) => (release = resolve))
      return () => {
        gates[command] = undefined
        release()
      }
    },
  }
})

vi.mock("@tauri-apps/api/core", () => ({ invoke: backend.invoke }))

/** A fresh copy of the module, as when the app starts. */
async function start(): Promise<Store> {
  vi.resetModules()
  return (await import("./sqlite")).sqliteStore
}

/** Lets queued promise callbacks run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(() => {
  localStorage.clear()
})

describeStoreContract("SQLite", async () => {
  backend.reset()
  const store = await start()
  await store.open()
  return store
})

describe("SQLite store", () => {
  beforeEach(() => {
    backend.reset()
  })

  describe("open", () => {
    it("reads in what the file holds", async () => {
      backend.seed("docs", doc("a"))
      backend.seed("folders", folder("f", "Work"))
      backend.rows("settings").set("andiko:migrated-from-indexeddb", '"1"')
      backend.rows("settings").set("andiko:tabs", JSON.stringify("[]"))
      const store = await start()
      await store.open()
      expect(await store.getDoc("a")).toEqual(doc("a"))
      expect(await store.listFolders()).toEqual([folder("f", "Work")])
      expect(store.getSetting("andiko:tabs")).toBe("[]")
    })

    it("reads the file once", async () => {
      const store = await start()
      await Promise.all([store.open(), store.open()])
      await store.open()
      expect(backend.loads).toBe(1)
    })

    it("can be tried again after it failed", async () => {
      backend.fail("store_load")
      const store = await start()
      await expect(store.open()).rejects.toBe("store_load failed")
      await store.open()
      expect(backend.loads).toBe(1)
    })
  })

  describe("moving in from IndexedDB", () => {
    afterEach(async () => {
      await Dexie.delete("andiko")
    })

    async function seedIndexedDb() {
      const { indexedDb } = await import("./indexeddb")
      await indexedDb.docs.add(doc("a", { folderId: "f" }))
      await indexedDb.folders.add(folder("f", "Work"))
      await indexedDb.history.add({ id: "a", history: { done: [] }, updatedAt: 1 })
      await indexedDb.publicCopies.add({ id: "p", title: "P", content: "# P", updatedAt: "", fetchedAt: 1 })
      indexedDb.close()
      localStorage.setItem("andiko:owner-token", "token")
      localStorage.setItem("andiko:tabs", '{"tabs":[]}')
      localStorage.setItem("andiko:last-doc", "a")
      localStorage.setItem("andiko:unrelated", "x")
    }

    it("copies everything into the file in one write", async () => {
      await seedIndexedDb()
      const store = await start()
      await store.open()

      expect(backend.writes).toHaveLength(1)
      expect(backend.writes[0].map(({ table, id }) => `${table}:${id}`)).toEqual([
        "docs:a",
        "folders:f",
        "history:a",
        "publicCopies:p",
        "settings:andiko:owner-token",
        "settings:andiko:tabs",
        "settings:andiko:last-doc",
        "settings:andiko:migrated-from-indexeddb",
      ])
      expect(await store.getDoc("a")).toEqual(doc("a", { folderId: "f" }))
      expect(await store.listFolders()).toEqual([folder("f", "Work")])
      expect((await store.getDocWithHistory("a")).history).toEqual({ id: "a", history: { done: [] }, updatedAt: 1 })
      expect(await store.getPublicCopy("p")).toMatchObject({ title: "P" })
      expect(store.getSetting("andiko:owner-token")).toBe("token")
      expect(store.getSetting("andiko:unrelated")).toBeNull()
    })

    it("happens once, and leaves IndexedDB as it was", async () => {
      await seedIndexedDb()
      await (await start()).open()
      const store = await start()
      await store.open()
      expect(backend.writes).toHaveLength(1)
      expect(await store.getDoc("a")).toBeDefined()

      const { indexedDb } = await import("./indexeddb")
      expect(await indexedDb.docs.count()).toBe(1)
      indexedDb.close()
    })

    it("only copies the settings when there is no IndexedDB", async () => {
      localStorage.setItem("andiko:owner-token", "token")
      const store = await start()
      await store.open()
      expect(backend.writes).toHaveLength(1)
      expect(backend.writes[0].map(({ table, id }) => `${table}:${id}`)).toEqual([
        "settings:andiko:owner-token",
        "settings:andiko:migrated-from-indexeddb",
      ])
    })

    it("is tried again on the next open when its write fails", async () => {
      await seedIndexedDb()
      backend.fail("store_write")
      const store = await start()
      await expect(store.open()).rejects.toBe("store_write failed")
      expect(backend.rows("docs").size).toBe(0)
      expect(backend.rows("settings").size).toBe(0)

      await store.open()
      expect(backend.writes).toHaveLength(2)
      expect(backend.rows("docs").has("a")).toBe(true)
      expect(store.getSetting("andiko:migrated-from-indexeddb")).not.toBeNull()
    })
  })

  describe("writes", () => {
    let store: Store

    beforeEach(async () => {
      store = await start()
      await store.open()
      backend.writes.length = 0
    })

    it("show at once and reach the file in order", async () => {
      const release = backend.hold("store_write")
      const first = store.addDoc(doc("a"))
      const second = store.saveDocContent("a", "# Edited")
      expect((await store.getDoc("a"))?.content).toBe("# Edited")
      await settle()
      // the second waits for the first to be on disk
      expect(backend.writes).toHaveLength(1)
      expect(backend.rows("docs").size).toBe(0)

      release()
      await Promise.all([first, second])
      expect(backend.writes.map((ops) => ops.map(({ value }) => (value as { content: string }).content))).toEqual([
        ["# A"],
        ["# Edited"],
      ])
      expect(JSON.parse(backend.rows("docs").get("a")!)).toMatchObject({ content: "# Edited" })
    })

    it("read a history only once the writes before are on disk", async () => {
      await store.addDoc(doc("a"))
      const release = backend.hold("store_write")
      const save = store.saveDocContent("a", "x", { done: [1] })
      const read = store.getDocWithHistory("a")
      release()
      await save
      expect((await read).history).toMatchObject({ history: { done: [1] } })
    })

    it("keep histories out of what is read in at start", async () => {
      await store.addDoc(doc("a"))
      await store.saveDocContent("a", "x", { done: [1] })
      expect(backend.rows("history").has("a")).toBe(true)
      const restarted = await start()
      await restarted.open()
      expect((await restarted.getDocWithHistory("a")).history).toMatchObject({ history: { done: [1] } })
    })

    it("are undone in memory when the file refuses them", async () => {
      await store.addDoc(doc("a"))
      backend.fail("store_write")
      await expect(store.saveDocContent("a", "lost")).rejects.toBe("store_write failed")
      await waitFor(async () => expect((await store.getDoc("a"))?.content).toBe("# A"))
      expect(backend.loads).toBe(2)
    })

    it("are read back only once no other write is waiting", async () => {
      backend.fail("store_write")
      const failed = store.addDoc(doc("lost"))
      const kept = store.addDoc(doc("kept"))
      await expect(failed).rejects.toBe("store_write failed")
      await kept
      await waitFor(() => expect(backend.loads).toBe(2))
      await settle()
      expect(await store.getDoc("lost")).toBeUndefined()
      expect(await store.getDoc("kept")).toBeDefined()
    })

    it("made while the file is read back aren't lost", async () => {
      backend.fail("store_write")
      const releaseLoad = backend.hold("store_load")
      await expect(store.addDoc(doc("lost"))).rejects.toBe("store_write failed")
      // read back from the file now, but held there
      await waitFor(() => expect(backend.invoke).toHaveBeenLastCalledWith("store_load"))
      const kept = store.addDoc(doc("kept"))
      releaseLoad()
      await kept
      // a snapshot without "kept" must not replace what is in memory
      expect(await store.getDoc("kept")).toBeDefined()
      await waitFor(() => expect(backend.loads).toBe(3))
      await settle()
      expect(await store.getDoc("lost")).toBeUndefined()
      expect(await store.getDoc("kept")).toBeDefined()
    })

    it("of a setting are skipped when its value is unchanged", async () => {
      store.setSetting("andiko:test", "a")
      await waitFor(() => expect(backend.writes).toHaveLength(1))
      store.setSetting("andiko:test", "a")
      await settle()
      expect(backend.writes).toHaveLength(1)
      expect(backend.rows("settings").get("andiko:test")).toBe('"a"')
    })
  })

  describe("useLiveQuery", () => {
    let store: Store

    beforeEach(async () => {
      store = await start()
      await store.open()
    })

    it("re-runs when the documents change", async () => {
      const { result } = renderHook(() => store.useLiveQuery(async () => (await store.listDocs()).map((d) => d.id), []))
      expect(result.current).toBeUndefined()
      await waitFor(() => expect(result.current).toEqual([]))
      await act(() => store.addDoc(doc("a")))
      await waitFor(() => expect(result.current).toEqual(["a"]))
    })

    it("re-runs when its deps change", async () => {
      await store.addTree([], [doc("a"), doc("b")])
      const { result, rerender } = renderHook(
        ({ id }) => store.useLiveQuery(async () => (await store.getDoc(id))?.title, [id]),
        { initialProps: { id: "a" } },
      )
      await waitFor(() => expect(result.current).toBe("A"))
      rerender({ id: "b" })
      await waitFor(() => expect(result.current).toBe("B"))
    })

    it("doesn't re-run for settings", async () => {
      const querier = vi.fn(() => store.listDocs())
      renderHook(() => store.useLiveQuery(querier, []))
      await waitFor(() => expect(querier).toHaveBeenCalledTimes(1))
      await act(async () => {
        store.setSetting("andiko:test", "a")
        await settle()
      })
      expect(querier).toHaveBeenCalledTimes(1)
      await act(() => store.addDoc(doc("a")))
      await waitFor(() => expect(querier).toHaveBeenCalledTimes(2))
    })
  })
})
