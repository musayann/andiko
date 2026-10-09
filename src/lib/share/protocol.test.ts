import { describe, expect, it } from "vitest"

import { shareIdFromSegment, sharePath, titleSlug } from "./protocol"

const ID = "gJeMsfVwk0h-"

describe("titleSlug", () => {
  it.each([
    ["Meeting Notes", "meeting-notes"],
    ["Hello, World!", "hello-world"],
    ["  Q3 -- plan / draft  ", "q3-plan-draft"],
    ["Résumé für Ångström", "resume-fur-angstrom"],
    ["会议记录", ""],
    ["", ""],
  ])("%j → %j", (title, slug) => expect(titleSlug(title)).toBe(slug))

  it("caps the length without leaving a trailing hyphen", () => {
    const slug = titleSlug(`${"word ".repeat(30)}`)
    expect(slug.length).toBeLessThanOrEqual(60)
    expect(slug).not.toMatch(/^-|-$/)
  })
})

describe("sharePath", () => {
  it("puts the title before the id", () => {
    expect(sharePath(ID, "Meeting Notes")).toBe(`/s/meeting-notes-${ID}`)
  })

  it("is the bare id when the title has no usable characters", () => {
    expect(sharePath(ID, "会议记录")).toBe(`/s/${ID}`)
  })
})

describe("shareIdFromSegment", () => {
  it.each([
    [`meeting-notes-${ID}`, ID],
    [ID, ID],
    ["old-title--abcdefghijk", "-abcdefghijk"],
    ["-abcdefghijk", "-abcdefghijk"],
  ])("reads the id from %s", (segment, id) => expect(shareIdFromSegment(segment)).toBe(id))

  it.each(["", "short", `meeting-notes${ID}`, `${ID}.`, "meeting-notes-gJeMsfVwk0h!"])("rejects %j", (segment) => {
    expect(shareIdFromSegment(segment)).toBeNull()
  })

  it("round-trips with sharePath", () => {
    const segment = sharePath(ID, "Any title at all").slice("/s/".length)
    expect(shareIdFromSegment(segment)).toBe(ID)
  })
})
