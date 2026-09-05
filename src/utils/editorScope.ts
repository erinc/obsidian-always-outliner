import { editorInfoField } from "obsidian";

import { EditorView } from "@codemirror/view";

/** Cell editors may inherit file info; only enforce the file's own editor. */
export function isNoteEditor(view: EditorView): boolean {
  const info = view.state.field(editorInfoField, false);
  const editor = info?.editor as { cm?: EditorView } | undefined;
  return editor?.cm === view;
}
