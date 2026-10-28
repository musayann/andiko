import { beforeEach, describe, expect, it } from "vitest"

import {
  activateTab,
  closeDocTabs,
  closeTab,
  cycleTab,
  getTabs,
  moveTab,
  openDocTab,
  openPublicTab,
  selectTabNumber,
} from "./tabs"

const keys = () => getTabs().tabs.map((tab) => (tab.kind === "doc" ? tab.docId : `p:${tab.shareId}`))

beforeEach(() => {
  closeDocTabs(["a", "b", "c"])
  for (const tab of [...getTabs().tabs]) closeTab(tab.kind === "doc" ? `doc:${tab.docId}` : `public:${tab.shareId}`)
})

describe("tabs", () => {
  it("opens, focuses instead of duplicating, and can open in the background", () => {
    openDocTab("a")
    openDocTab("b", { background: true })
    openDocTab("a")
    expect(keys()).toEqual(["a", "b"])
    expect(getTabs().active).toBe("doc:a")
    openPublicTab("xyz")
    expect(getTabs().active).toBe("public:xyz")
  })

  it("moves to the neighbour when the active tab closes", () => {
    openDocTab("a")
    openDocTab("b")
    openDocTab("c")
    activateTab("doc:b")
    closeTab("doc:b")
    expect(getTabs().active).toBe("doc:c")
    closeTab("doc:c")
    expect(getTabs().active).toBe("doc:a")
    closeTab("doc:a")
    expect(getTabs().active).toBeNull()
  })

  it("cycles, selects by number and reorders", () => {
    openDocTab("a")
    openDocTab("b")
    openDocTab("c")
    cycleTab(1)
    expect(getTabs().active).toBe("doc:a")
    cycleTab(-1)
    expect(getTabs().active).toBe("doc:c")
    selectTabNumber(2)
    expect(getTabs().active).toBe("doc:b")
    selectTabNumber(9)
    expect(getTabs().active).toBe("doc:c")
    moveTab(2, 0)
    expect(keys()).toEqual(["c", "a", "b"])
  })
})
