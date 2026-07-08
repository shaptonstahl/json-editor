# JSON Editor — Agent Context

## What this is

A cross-platform Chromium (Brave, Chrome, etc.) browser extension for editing and formatting JSON & JSONL.

## Architecture

- Chrome Extension (Manifest V3), pure ES6 modules, no build step
- CodeMirror 6 for the text editor, vendored in `dev/lib/codemirror/`
- Three source files: `dev/js/editor.js` (main logic, file I/O, formatting), `dev/js/tree.js` (interactive tree view), `dev/js/splitter.js` (pane resizer)
- Two-way sync: editor changes debounce-update the tree; tree inline edits update the editor
- File mode tracked by extension: `.json` (single document) or `.jsonl` (one JSON value per line)

## Conventions

- No comments that restate the code. Comments only for non-obvious invariants or workarounds.
- Section dividers use `// ── Name ──────────` style.
- Before a git commit suggest a new version number. First digit is a breaking change, second is a standard feature, third is a bug fix.