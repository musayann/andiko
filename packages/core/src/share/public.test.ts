import { describe, expect, it } from "vitest"

import { parseAndikoLink, parseShareInput } from "./public"

const ID = "abcdefghijkl"

describe("parseShareInput", () => {
  it("reads the id from public links, slugs and bare ids", () => {
    expect(parseShareInput(`https://andiko.app/s/my-notes-${ID}`)).toBe(ID)
    expect(parseShareInput(`https://andiko.app/s/${ID}`)).toBe(ID)
    expect(parseShareInput(`andiko://s/my-notes-${ID}`)).toBe(ID)
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

describe("parseAndikoLink", () => {
  it("opens public links on the site and in the app's scheme", () => {
    const link = { kind: "public", shareId: ID }
    expect(parseAndikoLink(`https://andiko.app/s/my-notes-${ID}`)).toEqual(link)
    expect(parseAndikoLink(`https://www.andiko.app/s/${ID}?utm_source=x#intro`)).toEqual(link)
    expect(parseAndikoLink(`andiko://s/my-notes-${ID}`)).toEqual(link)
    expect(parseAndikoLink(`andiko:///s/my-notes-${ID}`)).toEqual(link)
  })

  it("opens editor links, with the public copy they name", () => {
    expect(parseAndikoLink("https://andiko.app/d/localdoc01")).toEqual({ kind: "doc", docId: "localdoc01" })
    expect(parseAndikoLink(`andiko://d/localdoc01?share=${ID}`)).toEqual({ kind: "doc", docId: "localdoc01", shareId: ID })
    expect(parseAndikoLink("https://andiko.app/d/localdoc01?share=bad")).toEqual({ kind: "doc", docId: "localdoc01" })
  })

  it("leaves other links alone", () => {
    expect(parseAndikoLink(`https://example.com/s/my-notes-${ID}`)).toBeNull()
    expect(parseAndikoLink(`https://andiko.app.example.com/s/${ID}`)).toBeNull()
    expect(parseAndikoLink(`mailto:someone@andiko.app`)).toBeNull()
    expect(parseAndikoLink("https://andiko.app/")).toBeNull()
    expect(parseAndikoLink("https://andiko.app/privacy")).toBeNull()
    expect(parseAndikoLink("https://andiko.app/s/hello")).toBeNull()
    expect(parseAndikoLink(`https://andiko.app/s/${ID}/extra`)).toBeNull()
    expect(parseAndikoLink("andiko://")).toBeNull()
    expect(parseAndikoLink("not a link")).toBeNull()
  })
})
