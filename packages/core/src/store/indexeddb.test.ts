import { beforeEach, describe, expect, it } from "vitest"

import { describeStoreContract, doc, folder } from "./contract"
import { indexedDb, indexedDbStore as store } from "./indexeddb"

async function reset() {
  await Promise.all(indexedDb.tables.map((table) => table.clear()))
  localStorage.clear()
}

describeStoreContract("IndexedDB", async () => {
  await reset()
  return store
})

describe("IndexedDB store", () => {
  beforeEach(reset)

  it("keeps settings in localStorage", () => {
    store.setSetting("andiko:test", "a")
    expect(localStorage.getItem("andiko:test")).toBe("a")
  })

  it("refuses a document id that is already taken", async () => {
    await store.addDoc(doc("a"))
    await expect(store.addDoc(doc("a", { content: "other" }))).rejects.toThrow()
    expect((await store.getDoc("a"))?.content).toBe("# A")
  })

  it("adds a tree all or nothing", async () => {
    await store.addDoc(doc("taken"))
    await expect(store.addTree([folder("f", "F")], [doc("new", { folderId: "f" }), doc("taken")])).rejects.toThrow()
    expect(await store.listFolders()).toEqual([])
    expect(await store.getDoc("new")).toBeUndefined()
  })

  it("drops folderId when a document moves to the top level, so it isn't indexed", async () => {
    await store.addDoc(doc("a", { folderId: "f" }))
    await store.moveDoc("a", undefined)
    expect(await store.getDoc("a")).not.toHaveProperty("folderId")
  })
})
