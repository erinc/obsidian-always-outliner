import { EditorView } from "@codemirror/view";

import { isNoteEditor } from "../editorScope";

jest.mock(
  "obsidian",
  () => ({
    Plugin: class {},
    PluginSettingTab: class {},
    editorInfoField: {},
  }),
  { virtual: true },
);

test("enforces the parent note but excludes a cell sharing its file info", () => {
  const info: { editor: { cm?: unknown } } = { editor: {} };
  const note = { state: { field: () => info } };
  const cell = { state: { field: () => info } };
  info.editor.cm = note;
  expect(isNoteEditor(note as unknown as EditorView)).toBe(true);
  expect(isNoteEditor(cell as unknown as EditorView)).toBe(false);
});

test("excludes embedded editors without file info", () => {
  const cell = { state: { field: (): undefined => undefined } };
  expect(isNoteEditor(cell as unknown as EditorView)).toBe(false);
});
