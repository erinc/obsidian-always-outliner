import {
  App,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
} from "obsidian";

import { EditorSelection, Transaction } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";

import {
  decideEmptyBulletBackspace,
  isCursorBeforeContent,
  isEmptyTopLevelBullet,
  isListItem,
  isProtectedLineInDoc,
  outdentEmptyLine,
  splitPlainLine,
} from "./keys";
import { isNoteEditor } from "./utils/editorScope";
import {
  isVirtualBulletLine,
  normalizeStrictOutliner,
} from "./utils/normalizeStrictOutliner";

interface AlwaysOutlinerSettings {
  enabled: boolean;
}

const DEFAULT_SETTINGS: AlwaysOutlinerSettings = {
  enabled: true,
};

function getDefaultIndentChars(app: App): string {
  const config =
    (app.vault as unknown as { config?: { useTab?: boolean } }).config ?? {};
  const tabSize =
    (app.vault as unknown as { config?: { tabSize?: number } }).config
      ?.tabSize ?? 4;
  const useTab = config.useTab ?? true;

  return useTab ? "\t" : " ".repeat(tabSize);
}

function isComposing(view: EditorView): boolean {
  return (view as unknown as { composing?: boolean }).composing === true;
}

export default class AlwaysOutlinerPlugin extends Plugin {
  settings: AlwaysOutlinerSettings = { ...DEFAULT_SETTINGS };

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new AlwaysOutlinerSettingTab(this.app, this));

    // Enter and Backspace are intercepted in the capture phase instead of via
    // CodeMirror keymaps: Outliner registers its own handlers at the same
    // Prec.highest, so whichever plugin loaded first would win and Outliner
    // would handle empty/whitespace-only lines inside its lists before us.
    this.registerDomEvent(
      document,
      "keydown",
      (event) => this.handleKeydown(event),
      { capture: true },
    );

    this.registerEditorExtension(this.createNormalizerExtension());

    this.app.workspace.onLayoutReady(() => {
      this.normalizeOpenNotes();
      this.warnWhenOutlinerMissing();
    });
  }

  private handleKeydown(event: KeyboardEvent) {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      (event.key !== "Enter" && event.key !== "Backspace") ||
      !(event.target instanceof HTMLElement)
    ) {
      return;
    }

    const view = EditorView.findFromDOM(event.target);
    if (!view) {
      return;
    }

    const handled =
      event.key === "Enter"
        ? this.handleEnter(view)
        : this.handleBackspace(view);
    if (handled) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  /** Enter on a plain line splits it, marking only nonempty parts. Enter never
   * creates an extra empty line: on an empty line it only outdents, and at the
   * start of a line's content it does nothing. Everything else falls through
   * to the Outliner plugin. */
  private handleEnter(view: EditorView): boolean {
    if (!this.settings.enabled || !isNoteEditor(view) || isComposing(view)) {
      return false;
    }

    const { state } = view;
    if (state.selection.ranges.length !== 1) {
      return false;
    }

    const range = state.selection.main;
    const anchorLine = state.doc.lineAt(range.anchor);
    const headLine = state.doc.lineAt(range.head);
    if (anchorLine.number !== headLine.number) {
      return false;
    }

    const line = headLine;
    const docLines = state.doc.toString().split("\n");
    if (isProtectedLineInDoc(docLines, line.number - 1)) {
      return false;
    }
    if (
      line.text.trim().length === 0 &&
      !isVirtualBulletLine(docLines, line.number - 1)
    ) {
      return false;
    }

    if (line.text.trim().length === 0) {
      const outdented = outdentEmptyLine(
        line.text,
        getDefaultIndentChars(this.app),
      );
      if (outdented !== null) {
        view.dispatch({
          changes: { from: line.from, to: line.to, insert: outdented },
          selection: EditorSelection.cursor(line.from + outdented.length),
        });
      }
      return true;
    }

    if (
      range.empty &&
      isCursorBeforeContent(line.text, range.head - line.from)
    ) {
      return true;
    }

    if (!isListItem(line.text)) {
      const split = splitPlainLine({
        line: line.text,
        anchorCh: range.anchor - line.from,
        headCh: range.head - line.from,
      });
      if (!split) {
        return false;
      }

      view.dispatch({
        changes: { from: line.from, to: line.to, insert: split.insert },
        selection: EditorSelection.cursor(line.from + split.cursorOffset),
      });
      return true;
    }

    if (isEmptyTopLevelBullet(line.text)) {
      return true;
    }

    return false;
  }

  /**
   * Backspace on an empty bullet merges it up into the previous line, except
   * on the first line where the bullet is kept. Anything else falls through
   * to the Outliner plugin.
   */
  private handleBackspace(view: EditorView): boolean {
    if (!this.settings.enabled || !isNoteEditor(view) || isComposing(view)) {
      return false;
    }

    const { state } = view;
    if (state.selection.ranges.length !== 1) {
      return false;
    }

    const range = state.selection.main;
    if (!range.empty) {
      return false;
    }

    const line = state.doc.lineAt(range.head);
    const docLines = state.doc.toString().split("\n");
    if (
      line.text.trim().length === 0 &&
      !isVirtualBulletLine(docLines, line.number - 1)
    ) {
      return false;
    }
    const action = decideEmptyBulletBackspace({
      lineText: line.text,
      lineNumber: line.number,
    });

    if (action === "ignore") {
      return false;
    }

    if (action === "keep" || line.number <= 1) {
      return true;
    }

    const prev = state.doc.line(line.number - 1);
    if (isProtectedLineInDoc(docLines, line.number - 2)) {
      return true;
    }

    view.dispatch({
      changes: { from: prev.to, to: line.to, insert: "" },
      selection: EditorSelection.cursor(prev.to),
    });
    return true;
  }

  private createNormalizerExtension() {
    const plugin = this;

    return ViewPlugin.fromClass(
      class {
        private normalizationScheduled = false;
        private destroyed = false;
        decorations: DecorationSet;

        constructor(private view: EditorView) {
          this.decorations = buildVirtualBulletDecorations(
            view,
            plugin.settings.enabled,
          );
          this.scheduleNormalization();
        }

        update(update: ViewUpdate) {
          this.view = update.view;
          if (update.docChanged || update.selectionSet) {
            this.decorations = buildVirtualBulletDecorations(
              update.view,
              plugin.settings.enabled,
            );
          }
          if (update.docChanged || update.selectionSet) {
            this.scheduleNormalization();
          }
        }

        private scheduleNormalization() {
          if (this.normalizationScheduled) {
            return;
          }

          this.normalizationScheduled = true;
          queueMicrotask(() => {
            this.normalizationScheduled = false;
            if (this.destroyed || !plugin.settings.enabled) {
              return;
            }
            normalizeCodeMirrorView(
              this.view,
              getDefaultIndentChars(plugin.app),
            );
          });
        }

        destroy() {
          this.destroyed = true;
        }
      },
      {
        decorations: (value) => value.decorations,
      },
    );
  }

  private normalizeOpenNotes() {
    if (!this.settings.enabled) {
      return;
    }

    const indentChars = getDefaultIndentChars(this.app);
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (!(leaf.view instanceof MarkdownView)) {
        return;
      }

      const editor = leaf.view.editor;
      const source = editor.getValue();
      const normalization = normalizeStrictOutliner(source, indentChars);
      if (normalization.text === source) {
        return;
      }

      const selections = editor.listSelections().map((selection) => ({
        anchor: normalization.mapPosition(selection.anchor),
        head: normalization.mapPosition(selection.head),
      }));

      editor.setValue(normalization.text);
      editor.setSelections(selections);
    });
  }

  private warnWhenOutlinerMissing() {
    const plugins = (
      this.app as unknown as {
        plugins?: { getPlugin?: (id: string) => unknown };
      }
    ).plugins;

    if (!plugins?.getPlugin?.("obsidian-outliner")) {
      new Notice(
        "Always Outliner: enable the Outliner plugin to get full outliner behavior.",
      );
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class AlwaysOutlinerSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: AlwaysOutlinerPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("Always outliner mode")
      .setDesc(
        "Add bullets when lines have content. Show a temporary bullet on the active empty line. Works on top of the Outliner plugin.",
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.enabled)
          .onChange(async (value) => {
            this.plugin.settings.enabled = value;
            await this.plugin.saveSettings();
          });
      });
  }
}

function normalizeCodeMirrorView(view: EditorView, indentChars: string) {
  if (!isNoteEditor(view) || isComposing(view)) {
    return;
  }
  const source = view.state.doc.toString();
  const normalization = normalizeStrictOutliner(source, indentChars);
  // Never dispatch for selection alone: the text is already normalized, and
  // a selection-only transaction re-arms Outliner's cursor keeper, which then
  // fights Obsidian's Live Preview over where the cursor may sit.
  if (normalization.text === source) {
    return;
  }

  const lineStarts: number[] = [];
  let offset = 0;
  for (const line of normalization.text.split("\n")) {
    lineStarts.push(offset);
    offset += line.length + 1;
  }

  const mapOffset = (position: number) => {
    const sourceLine = view.state.doc.lineAt(position);
    const mapped = normalization.mapPosition({
      line: sourceLine.number - 1,
      ch: position - sourceLine.from,
    });
    return lineStarts[mapped.line] + mapped.ch;
  };

  const ranges = view.state.selection.ranges.map((range) =>
    EditorSelection.range(mapOffset(range.anchor), mapOffset(range.head)),
  );

  view.dispatch({
    selection: EditorSelection.create(ranges, view.state.selection.mainIndex),
    annotations: Transaction.addToHistory.of(false),
    changes: { from: 0, to: source.length, insert: normalization.text },
  });
}

/**
 * Mirrors the DOM Obsidian renders for a real bullet (a transparent `- `
 * marker with the dot drawn by `.list-bullet::after`), so the virtual bullet
 * picks up the theme's bullet size, color and indentation instead of
 * imitating them with a text glyph.
 */
class VirtualBulletWidget extends WidgetType {
  toDOM(): HTMLElement {
    const root = document.createElement("span");
    root.className = "always-outliner-virtual-bullet";
    root.setAttribute("aria-hidden", "true");

    const marker = root.createSpan({
      cls: "cm-formatting cm-formatting-list cm-formatting-list-ul cm-list-1",
    });
    marker.createSpan({ cls: "list-bullet", text: "-" });
    root.createSpan({ cls: "cm-list-1", text: " " });
    return root;
  }
}

function buildVirtualBulletDecorations(view: EditorView, enabled: boolean) {
  if (!enabled || !isNoteEditor(view)) {
    return Decoration.none;
  }
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const lines = view.state.doc.toString().split("\n");
  if (!isVirtualBulletLine(lines, line.number - 1)) {
    return Decoration.none;
  }
  // Same line classes Obsidian gives real list lines: tab size and spacing.
  const depth =
    (line.text.match(/\t/g)?.length ?? 0) +
    Math.floor((line.text.match(/ /g)?.length ?? 0) / 2) +
    1;
  return Decoration.set(
    [
      Decoration.line({
        class: `HyperMD-list-line HyperMD-list-line-${depth}`,
      }).range(line.from),
      Decoration.widget({ widget: new VirtualBulletWidget(), side: -1 }).range(
        line.to,
      ),
    ],
    true,
  );
}
