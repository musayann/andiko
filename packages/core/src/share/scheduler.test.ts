import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest"

import type { syncSharedDocs } from "./client"

vi.mock("./client", () => ({ syncSharedDocs: vi.fn() }))

let scheduler: typeof import("./scheduler")
let sync: Mock<typeof syncSharedDocs>

const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms)

beforeEach(async () => {
  vi.useFakeTimers()
  // the scheduler keeps its timer and failing state between calls
  vi.resetModules()
  scheduler = await import("./scheduler")
  sync = vi.mocked((await import("./client")).syncSharedDocs)
  sync.mockResolvedValue(true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("scheduleSync", () => {
  it("syncs once after a delay, however often it is asked", async () => {
    scheduler.scheduleSync()
    await advance(1000)
    scheduler.scheduleSync()
    await advance(999)
    expect(sync).not.toHaveBeenCalled()
    await advance(1)
    expect(sync).toHaveBeenCalledTimes(1)
    await advance(10_000)
    expect(sync).toHaveBeenCalledTimes(1)
  })

  it("schedules the next sync once one has started", async () => {
    scheduler.scheduleSync()
    await advance(2000)
    scheduler.scheduleSync()
    await advance(2000)
    expect(sync).toHaveBeenCalledTimes(2)
  })

  it("reports failure and retries until a sync gets through", async () => {
    sync.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error("offline"))
    const listener = vi.fn()
    scheduler.subscribeSyncFailing(listener)

    scheduler.scheduleSync()
    await advance(2000)
    expect(scheduler.isSyncFailing()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)

    await advance(29_999)
    expect(sync).toHaveBeenCalledTimes(1)
    await advance(1)
    expect(sync).toHaveBeenCalledTimes(2)
    expect(scheduler.isSyncFailing()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)

    await advance(30_000)
    expect(sync).toHaveBeenCalledTimes(3)
    expect(scheduler.isSyncFailing()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it("stops telling a listener once it unsubscribes", async () => {
    sync.mockResolvedValue(false)
    const listener = vi.fn()
    scheduler.subscribeSyncFailing(listener)()
    scheduler.scheduleSync()
    await advance(2000)
    expect(scheduler.isSyncFailing()).toBe(true)
    expect(listener).not.toHaveBeenCalled()
  })
})

describe("syncNow and cancelSync", () => {
  it("sync right away instead of after the delay", async () => {
    scheduler.scheduleSync()
    scheduler.syncNow()
    await advance(0)
    expect(sync).toHaveBeenCalledTimes(1)
    await advance(2000)
    expect(sync).toHaveBeenCalledTimes(1)
  })

  it("drop a sync that was due", async () => {
    scheduler.scheduleSync()
    scheduler.cancelSync()
    await advance(60_000)
    expect(sync).not.toHaveBeenCalled()
  })
})
