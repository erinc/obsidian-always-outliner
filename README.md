# Obsidian Always Outliner

Private companion plugin for [Obsidian Outliner](https://github.com/vslinko/obsidian-outliner)
that enforces outliner mode: every line is a bullet. Requires the Outliner
plugin installed and enabled; this plugin layers enforcement on top of it.

- Empty notes start with a bullet; blank and pasted plain-text lines become bullets.
- Indentation jumps are clamped to one child level.
- Frontmatter, fenced code blocks and tables are left alone.
- Enter on plain text splits it into two bullets; Enter on an empty top-level
  bullet keeps the bullet instead of exiting the list.
- Backspace on an empty bullet deletes the line and joins the previous line;
  the first bullet of a note is never removed.

## Install

Build first — `dist/` is gitignored, so a fresh clone has no bundle
(takes <1s on your machine):

```bash
npm run build
```

Copy `manifest.json`, `dist/main.js`, `styles.css` into
`<vault>/.obsidian/plugins/always-outliner/`, then enable Always Outliner
in Settings → Community plugins. Reload Obsidian after updating the files.

## Develop

```bash
npm run build   # bundle to dist/main.js
npm run dev     # watch mode
npm test        # unit tests
npm run lint    # prettier + eslint
```
