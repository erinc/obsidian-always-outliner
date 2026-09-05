# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Project Overview

Always Outliner is a private, unpublished companion plugin for
vslinko/obsidian-outliner that enforces outliner mode (like Workflowy). It
is NOT a fork: it installs alongside the upstream Outliner plugin
(id `obsidian-outliner`) under its own id `always-outliner` and layers
enforcement on top via CodeMirror extensions. No publishing machinery
remains (no CI, lockfile, license, or changelog); install by copying
`manifest.json`, `dist/main.js`, `styles.css` into the vault.

## Commands

```bash
npm run build       # Production build to dist/main.js
npm run dev         # Watch mode build

npm run lint        # Run prettier check + eslint on src/

npm test            # Run unit tests (pure, no Obsidian instance needed)
```

To run a single test file:
```bash
npx jest src/utils/__tests__/keys.test.ts --forceExit
```

## Directory Structure

```
src/
├── main.ts                       # Plugin entry: settings, keymaps, normalizer extension
├── keys.ts                       # Pure string helpers for Enter/Backspace (unit-tested)
└── utils/
    ├── normalizeStrictOutliner.ts # Pure line normalizer + cursor mapping
    └── __tests__/                # Unit tests (keys, normalizer)
```

## Architecture

The plugin registers three CodeMirror editor extensions:

1. `Prec.highest` Enter keymap — splits plain lines into two bullets and
   swallows Enter on empty top-level bullets. Returns `false` for real list
   lines so the upstream Outliner plugin handles them.
2. `Prec.high` Backspace keymap — swallows Backspace on the first line when
   it is an empty bullet, so the first bullet cannot be removed.
3. A `ViewPlugin` background normalizer — rewrites every physical line into
   a structurally valid list item (clamping indent jumps), except protected
   blocks (frontmatter, fenced code, tables). Text changes are dispatched
   with `Transaction.addToHistory.of(false)` so repairs don't pollute undo.

Keymap design rule: this plugin only claims keys the upstream plugin would
mishandle (plain lines, empty first bullet). Everything else must fall
through by returning `false`.

## Tests

Unit tests live in `src/**/__tests__/*.test.ts` and run with plain
`npm test` (node environment, no Obsidian needed). Keep helpers pure
(string in → string out) in `keys.ts`
and `normalizeStrictOutliner.ts` so they stay testable without Obsidian.
