import { describe, expect, it } from "vitest"

import { parseShareInput } from "./public"

const ID = "abcdefghijkl"

describe("parseShareInput", () => {
  it("reads the id from public links, slugs and bare ids", () => {
    expect(parseShareInput(`https://andiko.app/s/my-notes-${ID}`)).toBe(ID)
    expect(parseShareInput(`https://andiko.app/s/${ID}`)).toBe(ID)
    expect(parseShareInput(`  my-notes-${ID} `)).toBe(ID)
    expect(parseShareInput(ID)).toBe(ID)
  })

  it("reads the public id from an editor link", () => {
    expect(parseShareInput(`https://andiko.app/d/localdoc01?share=${ID}`)).toBe(ID)
  })

  it("rejects anything else", () => {
    expect(parseShareInput("")).toBeNull()
    expect(parseShareInput("https://example.com/about")).toBeNull()
    expect(parseShareInput("hello")).toBeNull()
  })
})
