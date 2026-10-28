import { describe, expect, it } from "vitest"

import { lineToOffset, offsetToLine, syncedScrollTop, type LineAnchor, type ScrollPane } from "./scroll-sync"

/** A pane whose content maps to source lines through anchors, as the preview does. */
const pane = (anchors: LineAnchor[], scrollTop = 0, clientHeight = 500): ScrollPane => ({
  scrollTop,
  clientHeight,
  scrollHeight: anchors[anchors.length - 1].top,
  lineAt: (y) => offsetToLine(anchors, y),
  offsetOf: (line) => lineToOffset(anchors, line),
})

const range = (anchors: LineAnchor[]) => anchors[anchors.length - 1].top - 500

// 100 lines of 20px each
const even: LineAnchor[] = [
  { line: 1, top: 0 },
  { line: 101, top: 2000 },
]
// the same, except that line 50 renders 600px tall, like a diagram or a table of contents
const tall: LineAnchor[] = [
  { line: 1, top: 0 },
  { line: 50, top: 980 },
  { line: 51, top: 1580 },
  { line: 101, top: 2580 },
]

/** Scrolls `source` from top to bottom in 8px steps and returns where `target` lands each time. */
function sweep(source: LineAnchor[], target: LineAnchor[]) {
  const positions: number[] = []
  for (let top = 0; top <= range(source); top += 8) positions.push(syncedScrollTop(pane(source, top), pane(target)))
  return positions
}

describe("lineToOffset and offsetToLine", () => {
  it("interpolate between anchors", () => {
    expect(lineToOffset(tall, 50.5)).toBe(1280)
    expect(offsetToLine(tall, 1280)).toBe(50.5)
    expect(lineToOffset(tall, 25.5)).toBe(490)
  })

  it("clamp outside the anchors", () => {
    expect(lineToOffset(tall, 0)).toBe(0)
    expect(lineToOffset(tall, 500)).toBe(2580)
    expect(offsetToLine(tall, 9999)).toBe(101)
  })
})

describe("syncedScrollTop", () => {
  it("keeps panes with the same layout at the same position", () => {
    for (const top of [0, 300, 750, 1500]) expect(syncedScrollTop(pane(even, top), pane(even))).toBeCloseTo(top)
  })

  it("brings the other pane to its top and bottom together, without a jump", () => {
    expect(syncedScrollTop(pane(even, 0), pane(tall))).toBe(0)
    expect(syncedScrollTop(pane(even, range(even)), pane(tall))).toBeCloseTo(range(tall))
    expect(syncedScrollTop(pane(tall, range(tall)), pane(even))).toBeCloseTo(range(even))
  })

  it("never moves the other pane backwards", () => {
    for (const [source, target] of [
      [even, tall],
      [tall, even],
    ]) {
      const positions = sweep(source, target)
      positions.slice(1).forEach((top, i) => expect(top).toBeGreaterThanOrEqual(positions[i]))
    }
  })

  it("eases into a block that is much taller in the other pane", () => {
    // without smoothing, the 20px source line would move the other pane by 600px in a step or two
    const positions = sweep(even, tall)
    const biggestStep = Math.max(...positions.slice(1).map((top, i) => top - positions[i]))
    expect(biggestStep).toBeLessThan(40)
  })

  it("leaves a pane that can't scroll at the top", () => {
    const short: LineAnchor[] = [
      { line: 1, top: 0 },
      { line: 11, top: 200 },
    ]
    expect(syncedScrollTop(pane(even, 800), pane(short))).toBe(0)
    expect(syncedScrollTop(pane(short), pane(even))).toBe(0)
  })
})
