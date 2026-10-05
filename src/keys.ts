/**
 * Pure, UI-free helpers for the Always Outliner companion plugin.
 *
 * They operate on plain strings so they stay unit-testable without
 * Obsidian or CodeMirror.
 */
import { isTableContentLine } from "./utils/normalizeStrictOutliner";

const listItemRe = /^([ \t]*)([-*+]|\d+\.)([ \t]+)(.*)$/;
const emptyBulletRe = /^[ \t]*([-*+]|\d+\.)[ \t]+(\[ \][ \t]*)?$/;
const topLevelEmptyBulletRe = /^([-*+]|\d+\.)[ \t]+(\[ \][ \t]*)?$/;

const frontmatterDelimiterRe = /^---[ \t]*$/;
const fencedCodeBlockDelimiterRe = /^[ \t]*(`{3,}|~{3,})/;
const markdownTableRowRe = /^[ \t]*\|/;

/**
 * Lines the enforcer must leave alone (single-line approximation of the
 * protected blocks in normalizeStrictOutliner: frontmatter, fenced code
 * blocks and tables are normalized as whole blocks, not per line).
 * Table rows count from the opening pipe so rows under construction are
 * left alone too and Obsidian's table handling keeps working.
 */
export function isProtectedLine(text: string): boolean {
  return (
    frontmatterDelimiterRe.test(text) ||
    fencedCodeBlockDelimiterRe.test(text) ||
    markdownTableRowRe.test(text)
  );
}

/**
 * Doc-aware version of isProtectedLine: additionally recognizes table rows
 * without outer pipes through their delimiter context.
 */
export function isProtectedLineInDoc(lines: string[], index: number): boolean {
  const line = lines[index] ?? "";
  return isProtectedLine(line) || isTableContentLine(lines, index);
}

export function isListItem(text: string): boolean {
  return listItemRe.test(text);
}

/**
 * An empty top-level bullet (`- `, `1. `, `- [ ] `). Pressing Enter here
 * must keep the bullet instead of exiting the list.
 */
export function isEmptyTopLevelBullet(text: string): boolean {
  return topLevelEmptyBulletRe.test(text);
}

/** Any empty bullet; used for the first-line Backspace guard. */
export function isEmptyBullet(text: string): boolean {
  return emptyBulletRe.test(text);
}

export type EmptyBulletBackspace = "keep" | "mergeUp" | "ignore";

/**
 * Decides what Backspace does on a line with an empty selection.
 * - empty item on the first line: keep the line (swallow the key)
 * - empty item on any other line: delete the line and join with the
 *   previous one
 * - anything else: ignore (let upstream or the editor handle it)
 */
export function decideEmptyBulletBackspace(args: {
  lineText: string;
  lineNumber: number; // 1-based, as in CodeMirror
}): EmptyBulletBackspace {
  if (!isEmptyBullet(args.lineText) && args.lineText.trim().length !== 0) {
    return "ignore";
  }

  return args.lineNumber === 1 ? "keep" : "mergeUp";
}

export interface PlainLineSplit {
  /** Two lines joined by `\n`; only lines with content get a marker. */
  insert: string;
  /** Offset from the start of `insert` to the new cursor position. */
  cursorOffset: number;
}

/**
 * Splits a plain (non-list) line at a same-line selection, adding markers
 * only to nonempty parts. Returns null for list items and protected lines.
 */
export function splitPlainLine(args: {
  line: string;
  anchorCh: number;
  headCh: number;
}): PlainLineSplit | null {
  const { line } = args;

  if (isListItem(line) || isProtectedLine(line)) {
    return null;
  }

  const indent = line.match(/^[ \t]*/)?.[0] ?? "";
  const from = Math.max(indent.length, Math.min(args.anchorCh, args.headCh));
  const to = Math.max(indent.length, Math.max(args.anchorCh, args.headCh));

  const first = line.slice(indent.length, from);
  const second = line.slice(to);
  const firstLine = first.length > 0 ? `${indent}- ${first}` : indent;
  const secondLine = second.length > 0 ? `${indent}- ${second}` : indent;

  return {
    insert: `${firstLine}\n${secondLine}`,
    cursorOffset:
      firstLine.length + 1 + indent.length + (second.length > 0 ? 2 : 0),
  };
}
