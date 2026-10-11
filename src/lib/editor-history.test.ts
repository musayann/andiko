import { history, isolateHistory, redo, redoDepth, undo, undoDepth } from "@codemirror/commands"
import { EditorState, type StateCommand } from "@codemirror/state"
import { describe, expect, it } from "vitest"

import { historyToJSON, restoreState } from "./editor-history"

// separate undo steps, as if typed more than CodeMirror's grouping delay apart
function edit(state: EditorState, insert: string): EditorState {
  return state.update({ changes: { from: state.doc.length, insert }, annotations: isolateHistory.of("full") }).state
}

function run(state: EditorState, command: StateCommand): EditorState {
  let next = state
  command({ state, dispatch: (tr) => (next = tr.state) })
  return next
}

function reload(state: EditorState): EditorState {
  const initial = restoreState(state.doc.toString(), JSON.parse(JSON.stringify(historyToJSON(state))))
  expect(initial).toBeDefined()
  return EditorState.fromJSON(initial!.json, { extensions: history() }, initial!.fields)
}

describe("editor history", () => {
  it("undoes and redoes edits made before a reload", () => {
    let state = EditorState.create({ doc: "a", extensions: history() })
    state = edit(edit(state, "b"), "c")

    let restored = reload(state)
    expect(restored.doc.toString()).toBe("abc")
    expect(undoDepth(restored)).toBe(2)

    restored = run(run(restored, undo), undo)
    expect(restored.doc.toString()).toBe("a")
    expect(undoDepth(restored)).toBe(0)

    restored = run(reload(restored), redo)
    expect(restored.doc.toString()).toBe("ab")
    expect(redoDepth(restored)).toBe(1)
  })

  it("starts with the cursor at the start", () => {
    let state = EditorState.create({ doc: "a", extensions: history() })
    state = edit(state, "b")
    expect(reload(state).selection.main.head).toBe(0)
  })

  it("rejects a history it can't read", () => {
    expect(restoreState("abc", { done: "nope" })).toBeUndefined()
    expect(restoreState("abc", null)).toBeUndefined()
  })
})
