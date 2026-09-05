# Obsidian Always Outliner

Private companion plugin for [Obsidian Outliner](https://github.com/vslinko/obsidian-outliner)
that enforces outliner mode: every line is a bullet. Requires the Outliner
plugin installed and enabled; this plugin layers enforcement on top of it.

- Empty notes start with a bullet; blank and pasted plain-text lines become bullets.
- Indentation jumps are clamped to one child level.
- Frontmatter, fenced code blocks and tables are left alone.
- Enter on plain text splits it into two bullets; Enter on an empty top-level
  bullet keeps the bullet; Backspace cannot remove the first bullet.

## Install

Copy `manifest.json`, `dist/main.js`, `styles.css` into
`<vault>/.obsidian/plugins/always-outliner/`, then enable Always Outliner
in Settings → Community plugins.

## Develop

```bash
npm run build   # bundle to dist/main.js
npm run dev     # watch mode
npm test        # unit tests
npm run lint    # prettier + eslint
```
