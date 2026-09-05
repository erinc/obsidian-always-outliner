export interface LineAndCharacter {
  line: number;
  ch: number;
}

interface LineMapping {
  oldContentStart: number;
  newContentStart: number;
  newLength: number;
}

export interface StrictOutlinerNormalization {
  text: string;
  mapPosition(position: LineAndCharacter): LineAndCharacter;
}

const listItemRe = /^([ \t]*)([-*+]|\d+\.)([ \t]+)(.*)$/;
const emptyListItemRe = /^([ \t]*)([-*+]|\d+\.)([ \t]*)$/;

export interface TextRange {
  from: number;
  to: number;
}

/** Returns marker ranges for list items with no content. */
export function findEmptyListMarkers(text: string): TextRange[] {
  const ranges: TextRange[] = [];
  let lineOffset = 0;

  for (const line of text.split("\n")) {
    const match = line.match(emptyListItemRe);
    if (match) {
      const from = lineOffset + match[1].length;
      ranges.push({ from, to: from + match[2].length });
    }
    lineOffset += line.length + 1;
  }

  return ranges;
}
const frontmatterDelimiterRe = /^---[ \t]*$/;
const optionalListMarkerRe = String.raw`(?:(?:[-*+]|\d+\.)[ \t]+)?`;
const fencedCodeBlockRe = new RegExp(
  String.raw`^[ \t]*${optionalListMarkerRe}(` + "`{3,}|~{3,})",
);
// Any line starting with a pipe is a table row, including rows still under
// construction (e.g. `| a` before its closing pipe is typed). These must be
// left alone so Obsidian's table creation and editing keep working.
const markdownTableRowRe = /^[ \t]*\|/;

function protectedLines(sourceLines: string[]) {
  const protectedLineIndexes = new Set<number>();
  const protectedBlockLineIndexes = new Set<number>();
  let frontmatterOpen = sourceLines[0]?.match(frontmatterDelimiterRe) != null;
  let fenceMarker: { character: string; length: number } | null = null;

  for (let index = 0; index < sourceLines.length; index++) {
    const sourceLine = sourceLines[index];

    if (frontmatterOpen) {
      protectedLineIndexes.add(index);
      if (index > 0 && frontmatterDelimiterRe.test(sourceLine)) {
        frontmatterOpen = false;
      }
      continue;
    }

    if (fenceMarker) {
      protectedLineIndexes.add(index);
      protectedBlockLineIndexes.add(index);
      const trimmedLine = sourceLine.trimStart();
      const closingFenceRe = new RegExp(
        String.raw`^${optionalListMarkerRe}${fenceMarker.character}{${fenceMarker.length},}[ \t]*$`,
      );
      if (closingFenceRe.test(trimmedLine)) {
        fenceMarker = null;
      }
      continue;
    }

    const fenceMatch = sourceLine.match(fencedCodeBlockRe);
    if (fenceMatch) {
      protectedLineIndexes.add(index);
      protectedBlockLineIndexes.add(index);
      fenceMarker = {
        character: fenceMatch[1][0],
        length: fenceMatch[1].length,
      };
      continue;
    }

    if (markdownTableRowRe.test(sourceLine)) {
      protectedLineIndexes.add(index);
      protectedBlockLineIndexes.add(index);
    }
  }

  for (const index of protectedBlockLineIndexes) {
    for (let before = index - 1; before >= 0; before--) {
      if (sourceLines[before].trim().length > 0) {
        break;
      }
      protectedLineIndexes.add(before);
    }
    for (let after = index + 1; after < sourceLines.length; after++) {
      if (sourceLines[after].trim().length > 0) {
        break;
      }
      protectedLineIndexes.add(after);
    }
  }

  return protectedLineIndexes;
}

function indentationLevel(indent: string, indentChars: string) {
  const unitWidth = indentChars === "\t" ? 4 : Math.max(indentChars.length, 1);
  let columns = 0;

  for (const char of indent) {
    columns += char === "\t" ? unitWidth : 1;
  }

  return Math.ceil(columns / unitWidth);
}

/**
 * Enforces the strict Workflowy invariant: every physical line is a list item.
 * Invalid indentation jumps are clamped so a line can only be one level deeper
 * than the item immediately before it.
 */
export function normalizeStrictOutliner(
  text: string,
  indentChars: string,
): StrictOutlinerNormalization {
  const sourceLines = text.split("\n");
  const protectedLineIndexes = protectedLines(sourceLines);
  const normalizedLines: string[] = [];
  const mappings: LineMapping[] = [];
  let previousLevel = 0;

  for (let index = 0; index < sourceLines.length; index++) {
    const sourceLine = sourceLines[index];

    if (protectedLineIndexes.has(index)) {
      normalizedLines.push(sourceLine);
      mappings.push({
        oldContentStart: 0,
        newContentStart: 0,
        newLength: sourceLine.length,
      });
      continue;
    }

    const listMatch = sourceLine.match(listItemRe);
    const emptyMarkerMatch = listMatch
      ? null
      : sourceLine.match(emptyListItemRe);
    const leadingWhitespace = sourceLine.match(/^[ \t]*/)?.[0] ?? "";
    const marker = listMatch?.[2] ?? emptyMarkerMatch?.[2] ?? "-";
    const content = listMatch
      ? listMatch[4]
      : emptyMarkerMatch
        ? ""
        : sourceLine.slice(leadingWhitespace.length);
    const oldContentStart = listMatch
      ? listMatch[1].length + listMatch[2].length + listMatch[3].length
      : leadingWhitespace.length;

    let level = indentationLevel(leadingWhitespace, indentChars);
    if (index === 0) {
      level = 0;
    } else if (sourceLine.trim().length === 0) {
      level = previousLevel;
    } else {
      level = Math.min(level, previousLevel + 1);
    }

    const indent = indentChars.repeat(level);
    const normalizedLine = `${indent}${marker} ${content}`;
    const newContentStart = indent.length + marker.length + 1;

    normalizedLines.push(normalizedLine);
    mappings.push({
      oldContentStart,
      newContentStart,
      newLength: normalizedLine.length,
    });
    previousLevel = level;
  }

  return {
    text: normalizedLines.join("\n"),
    mapPosition(position) {
      const line = Math.max(0, Math.min(position.line, mappings.length - 1));
      const mapping = mappings[line];
      const contentOffset = Math.max(0, position.ch - mapping.oldContentStart);
      const ch = Math.min(
        mapping.newLength,
        mapping.newContentStart + contentOffset,
      );

      return { line, ch };
    },
  };
}
