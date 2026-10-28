import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getDocWithHistory, isDraft, saveDocContent, setLastDocId, type Doc } from "../db"
import { useDoc } from "./use-doc"

vi.mock("../db", () => ({
  getDocWithHistory: vi.fn(),
  isDraft: vi.fn(),
  saveDocContent: vi.fn(),
  setLastDocId: vi.fn(),
}))

const DOC: Doc = { id: "a", title: "A", content: "# A", fileName: "a-file", createdAt: 1, updatedAt: 100 }
const HISTORY = { id: "a", history: { done: [1] }, updatedAt: 100 }
const BACKUP_KEY = "andiko:unsaved:a"

/** Mounts the hook and lets the document load. */
async function mount() {
  const hook = renderHook(() => useDoc("a"))
  await act(() => vi.advanceTimersByTimeAsync(0))
  return hook
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1000)
  vi.mocked(getDocWithHistory).mockResolvedValue({ doc: DOC, history: HISTORY })
  vi.mocked(isDraft).mockReturnValue(false)
  vi.mocked(saveDocContent).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  localStorage.clear()
})

describe("loading", () => {
  it("opens the document with the undo history saved with it", async () => {
    const { result } = await mount()
    expect(result.current.load).toEqual({
      status: "ready",
      initialContent: "# A",
      fileName: "a-file",
      history: HISTORY.history,
    })
    expect(result.current.content).toBe("# A")
    expect(result.current.saveState).toBe("saved")
    expect(setLastDocId).toHaveBeenCalledWith("a")
  })

  it("drops a history saved for other content", async () => {
    vi.mocked(getDocWithHistory).mockResolvedValue({ doc: DOC, history: { ...HISTORY, updatedAt: 99 } })
    const { result } = await mount()
    expect(result.current.load).toMatchObject({ status: "ready", history: undefined })
  })

  it("reports a missing document", async () => {
    vi.mocked(getDocWithHistory).mockResolvedValue({})
    const { result } = await mount()
    expect(result.current.load).toEqual({ status: "missing" })
    expect(setLastDocId).not.toHaveBeenCalled()
  })

  it("opens a new tab's draft empty", async () => {
    vi.mocked(getDocWithHistory).mockResolvedValue({})
    vi.mocked(isDraft).mockReturnValue(true)
    const { result } = await mount()
    expect(result.current.load).toEqual({ status: "ready", initialContent: "" })
  })

  it("restores text that didn't get saved before the page closed", async () => {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ content: "# A, newer", at: 200 }))
    const { result } = await mount()
    expect(result.current.load).toMatchObject({ status: "ready", initialContent: "# A, newer", history: undefined })
    expect(saveDocContent).toHaveBeenCalledWith("a", "# A, newer")
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull()
  })

  it("discards a backup older than the stored document", async () => {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ content: "# A, older", at: 50 }))
    const { result } = await mount()
    expect(result.current.load).toMatchObject({ initialContent: "# A", history: HISTORY.history })
    expect(saveDocContent).not.toHaveBeenCalled()
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull()
  })
})

describe("saving", () => {
  it("saves once typing pauses, with the history at that moment", async () => {
    const { result } = await mount()
    const firstHistory = vi.fn(() => "first")
    act(() => result.current.setContent("# A1", firstHistory))
    expect(result.current.saveState).toBe("unsaved")
    await act(() => vi.advanceTimersByTimeAsync(400))
    act(() => result.current.setContent("# A12", () => "second"))
    await act(() => vi.advanceTimersByTimeAsync(499))
    expect(saveDocContent).not.toHaveBeenCalled()

    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(saveDocContent).toHaveBeenCalledTimes(1)
    expect(saveDocContent).toHaveBeenCalledWith("a", "# A12", "second")
    expect(firstHistory).not.toHaveBeenCalled()
    expect(result.current.saveState).toBe("saved")
  })

  it("stores a draft on its first edit right away", async () => {
    vi.mocked(getDocWithHistory).mockResolvedValue({})
    vi.mocked(isDraft).mockReturnValue(true)
    const { result } = await mount()
    act(() => result.current.setContent("h"))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(saveDocContent).toHaveBeenCalledWith("a", "h", undefined)
  })

  it("stays unsaved when a save fails, and tries again on the next flush", async () => {
    vi.mocked(saveDocContent).mockRejectedValueOnce(new Error("disk full"))
    const { result } = await mount()
    act(() => result.current.setContent("# A1"))
    await act(() => vi.advanceTimersByTimeAsync(500))
    expect(result.current.saveState).toBe("unsaved")

    await act(() => result.current.flush())
    expect(saveDocContent).toHaveBeenCalledTimes(2)
    expect(saveDocContent).toHaveBeenLastCalledWith("a", "# A1", undefined)
    expect(result.current.saveState).toBe("saved")
  })

  it("parks unsaved text and saves it when the page is hidden", async () => {
    const { result } = await mount()
    act(() => result.current.setContent("# A1"))
    await act(async () => {
      window.dispatchEvent(new Event("pagehide"))
    })
    expect(JSON.parse(localStorage.getItem(BACKUP_KEY)!)).toEqual({ content: "# A1", at: 1000 })
    expect(saveDocContent).toHaveBeenCalledWith("a", "# A1", undefined)
  })

  it("saves pending text when it unmounts", async () => {
    const { result, unmount } = await mount()
    act(() => result.current.setContent("# A1"))
    unmount()
    expect(saveDocContent).toHaveBeenCalledWith("a", "# A1", undefined)
  })

  it("has nothing to save without edits", async () => {
    const { unmount } = await mount()
    await act(async () => {
      window.dispatchEvent(new Event("pagehide"))
    })
    unmount()
    expect(saveDocContent).not.toHaveBeenCalled()
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull()
  })
})
