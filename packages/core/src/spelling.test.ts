import { describe, expect, it } from "vitest"

import { spellingWordAt, spellingWords } from "./spelling"

describe("spellingWords", () => {
  it("lists each word once, in order", () => {
    expect(spellingWords("teh cat saw teh dog")).toEqual(["teh", "cat", "saw", "dog"])
  })

  it("keeps inner apostrophes and accents", () => {
    expect(spellingWords("don't stop, l’été arrive")).toEqual(["don't", "stop", "l’été", "arrive"])
  })

  it("leaves out numbers, symbols and Markdown", () => {
    expect(spellingWords("## 42 **bold** _it_ 'quoted'")).toEqual(["bold", "it", "quoted"])
  })

  it("splits words joined by digits, underscores or hyphens", () => {
    expect(spellingWords("abc123def snake_case well-known")).toEqual(["abc", "def", "snake", "case", "well", "known"])
  })

  it("handles text without words", () => {
    expect(spellingWords("")).toEqual([])
    expect(spellingWords("- 1. ---")).toEqual([])
  })
})

describe("spellingWordAt", () => {
  const text = "Say teh word, don't."

  it("finds the word at, or touching, the offset", () => {
    expect(spellingWordAt(text, 4)).toEqual({ word: "teh", from: 4, to: 7 })
    expect(spellingWordAt(text, 5)).toEqual({ word: "teh", from: 4, to: 7 })
    expect(spellingWordAt(text, 7)).toEqual({ word: "teh", from: 4, to: 7 })
    expect(spellingWordAt(text, 16)).toEqual({ word: "don't", from: 14, to: 19 })
  })

  it("finds nothing between words", () => {
    expect(spellingWordAt(text, 13)).toBeNull()
    expect(spellingWordAt("a  b", 2)).toBeNull()
    expect(spellingWordAt("", 0)).toBeNull()
  })
})
