import { describe, expect, it } from "vitest"

import { getDocTitle } from "./title"

describe("getDocTitle", () => {
  it("prefers the front-matter title, then the first H1", () => {
    expect(getDocTitle("---\ntitle: Front\n---\n# Heading", "file")).toBe("Front")
    expect(getDocTitle("intro\n# Heading", "file")).toBe("Heading")
  })

  it("falls back to the given name, else Untitled", () => {
    expect(getDocTitle("no heading here", "Meeting Notes")).toBe("Meeting Notes")
    expect(getDocTitle("no heading here")).toBe("Untitled")
  })
})
