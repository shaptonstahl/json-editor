# JSON Editor

A browser extension for editing and formatting JSON and JSONL files. Two-pane interface with a collapsible tree view on the left and a full-featured code editor on the right.

## Features

- **Tree view** — interactive, collapsible tree with inline value editing (double-click any value)
- **Code editor** — syntax highlighting, bracket matching, code folding, search & replace (powered by CodeMirror 6)
- **Prettify / Minify** — format JSON with 2-space indentation or compress to a single line
- **Sort keys** — sort object keys alphabetically: globally via toolbar, or at a specific node via right-click context menu (shallow or recursive)
- **JSONL support** — open and edit JSON Lines files; each line is parsed and displayed independently in the tree
- **File I/O** — open, save, and save-as with the File System Access API; dirty state tracking with unsaved-changes indicator

## Install

### From source

1. Clone this repo
2. Open `chrome://extensions` (or `brave://extensions`, etc.)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the `dev/` folder

## Usage

Click the extension icon to open the editor in a new tab. Use **Open** to load a `.json` or `.jsonl` file, or paste/type JSON directly into the code editor.

| Action | How |
|--------|-----|
| Open file | **Open** button or `Ctrl+O` |
| Save | **Save** button or `Ctrl+S` |
| Save as | **Save As** button or `Ctrl+Shift+S` |
| Pretty-print | **Prettify** button |
| Compact | **Minify** button |
| Sort all keys | **Sort Keys** button |
| Sort keys at node | Right-click an object node in the tree |
| Edit a value | Double-click a leaf value in the tree |
| Collapse/expand tree | **Collapse All** / **Expand All** buttons |

## Project structure

```
dev/
├── manifest.json          # Chrome extension manifest (v3)
├── background.js          # Opens editor tab on icon click
├── editor.html            # Main UI
├── js/
│   ├── editor.js          # App logic, file I/O, formatting
│   ├── tree.js            # Tree view renderer
│   └── splitter.js        # Pane resizer
├── css/
│   └── main.css           # Dark theme styling
└── lib/codemirror/        # Vendored CodeMirror 6
```
