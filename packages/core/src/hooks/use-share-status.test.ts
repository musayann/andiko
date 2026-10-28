import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createDoc, getDoc, markDocSynced, setDocShare } from "../db"
import { indexedDb } from "../store/indexeddb"
import { useShareStatus } from "./use-share-status"

const scheduler = vi.hoisted(() => ({ failing: false, listeners: new Set<() => void>() }))

vi.mock("../share/scheduler", () => ({
  isSyncFailing: () => scheduler.failing,
  subscribeSyncFailing(listener: () => void) {
    scheduler.listeners.add(listener)
    return () => scheduler.listeners.delete(listener)
  },
}))

function setFailing(failing: boolean) {
  scheduler.failing = failing
  scheduler.listeners.forEach((listener) => listener())
}

beforeEach(async () => {
  await indexedDb.docs.clear()
  scheduler.failing = false
})

describe("useShareStatus", () => {
  it("is not loaded until the document has been read", async () => {
    const id = await createDoc("# Private")
    const { result } = renderHook(() => useShareStatus(id))
    expect(result.current.loaded).toBe(false)
    await waitFor(() => expect(result.current).toEqual({ loaded: true, shareId: undefined, sync: "synced" }))
  })

  it("follows a published document as it falls behind and catches up", async () => {
    const id = await createDoc("# Notes")
    await setDocShare(id, "abcdefghijkl", (await getDoc(id))!.updatedAt)
    const { result } = renderHook(() => useShareStatus(id))
    await waitFor(() => expect(result.current).toEqual({ loaded: true, shareId: "abcdefghijkl", sync: "synced" }))

    await act(() => setDocShare(id, "abcdefghijkl", 0))
    await waitFor(() => expect(result.current.sync).toBe("syncing"))

    act(() => setFailing(true))
    expect(result.current.sync).toBe("failing")

    await act(() => markDocSynced(id, "abcdefghijkl", Date.now()))
    await waitFor(() => expect(result.current.sync).toBe("synced"))
  })
})
