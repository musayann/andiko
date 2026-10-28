import { history as historyExtension, historyField } from "@codemirror/commands"
import { EditorSelection, EditorState } from "@codemirror/state"

/**
 * Stores and restores the editor's undo history, so undo and redo reach back
 * past a reload. The history is kept as CodeMirror serializes it.
 */

const fields = { history: historyField }

/** The undo history of `state`, ready to store. */
export function historyToJSON(state: EditorState): unknown {
  return state.toJSON(fields).history
}

/**
 * The editor's `initialState` for `content` with a stored history, the cursor
 * at the start. Undefined when the history can't be read.
 */
export function restoreState(content: string, history: unknown) {
  const json = { doc: content, selection: EditorSelection.single(0).toJSON(), history }
  try {
    // a history the editor can't read would otherwise break it as it opens
    EditorState.fromJSON(json, { extensions: historyExtension() }, fields)
  } catch {
    return undefined
  }
  return { json, fields }
}
