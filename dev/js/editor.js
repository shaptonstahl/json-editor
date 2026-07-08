import { EditorView, keymap, highlightActiveLine, lineNumbers, highlightActiveLineGutter, drawSelection } from "../lib/codemirror/cm-view.js";
import { EditorState } from "../lib/codemirror/cm-state.js";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "../lib/codemirror/cm-commands.js";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentOnInput } from "../lib/codemirror/cm-language.js";
import { searchKeymap, highlightSelectionMatches } from "../lib/codemirror/cm-search.js";
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from "../lib/codemirror/cm-autocomplete.js";
import { lintKeymap } from "../lib/codemirror/cm-lint.js";
import { json } from "../lib/codemirror/cm-lang-json.js";
import { renderTree, renderJsonlTree, applyEdit, getAtPath } from "./tree.js";
import { initSplitter } from "./splitter.js";

// ── State ──────────────────────────────────────────────────
let fileHandle = null;
let isDirty = false;
let ignoreEditorChange = false;
let treeDebounceTimer = null;
let fileMode = "json"; // "json" or "jsonl"

const elFileName    = document.getElementById("file-name");
const elDirty       = document.getElementById("dirty-indicator");
const elBtnSave     = document.getElementById("btn-save");
const elBtnOpen     = document.getElementById("btn-open");
const elBtnSaveAs   = document.getElementById("btn-save-as");
const elBtnPrettify = document.getElementById("btn-prettify");
const elBtnMinify   = document.getElementById("btn-minify");
const elBtnSortKeys = document.getElementById("btn-sort-keys");
const elBtnCollapse = document.getElementById("btn-collapse-all");
const elBtnExpand   = document.getElementById("btn-expand-all");
const elTreeContainer = document.getElementById("tree-container");
const elTreeError     = document.getElementById("tree-error");
const elEditorContainer = document.getElementById("editor-container");

// ── CodeMirror setup ───────────────────────────────────────
function buildExtensions() {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    foldGutter(),
    history(),
    drawSelection(),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    json(),
    EditorView.lineWrapping,
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...completionKeymap,
      ...lintKeymap,
      indentWithTab,
    ]),
    EditorView.theme({
      "&": { height: "100%", background: "#1e1e1e" },
      ".cm-content": { caretColor: "#aeafad" },
      ".cm-cursor": { borderLeftColor: "#aeafad" },
      ".cm-gutters": { background: "#1e1e1e", color: "#858585", borderRight: "1px solid #3e3e42" },
      ".cm-activeLine": { background: "#2a2d2e" },
      ".cm-activeLineGutter": { background: "#2a2d2e" },
      ".cm-selectionBackground, ::selection": { background: "#264f78 !important" },
    }),
    EditorView.updateListener.of(update => {
      if (update.docChanged && !ignoreEditorChange) {
        setDirty(true);
        scheduleTreeUpdate();
      }
    }),
  ];
}

const view = new EditorView({
  state: EditorState.create({
    doc: "",
    extensions: buildExtensions(),
  }),
  parent: elEditorContainer,
});

// ── Dirty state ────────────────────────────────────────────
function setDirty(dirty) {
  isDirty = dirty;
  elDirty.classList.toggle("dirty", dirty);
  document.title = dirty ? "● JSON Editor" : "JSON Editor";
  elBtnSave.disabled = !dirty || !fileHandle;
}

// ── Sort key utilities ────────────────────────────────────
function sortKeysShallow(obj) {
  if (Array.isArray(obj) || typeof obj !== "object" || obj === null) return obj;
  const sorted = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
  return sorted;
}

function sortKeysDeep(obj) {
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  if (typeof obj !== "object" || obj === null) return obj;
  const sorted = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = sortKeysDeep(obj[k]);
  return sorted;
}

// ── Tree sync ──────────────────────────────────────────────
function scheduleTreeUpdate() {
  clearTimeout(treeDebounceTimer);
  treeDebounceTimer = setTimeout(syncTree, 300);
}

function syncTree() {
  const text = view.state.doc.toString();
  elTreeError.textContent = "";

  if (!text.trim()) {
    elTreeContainer.textContent = "";
    return;
  }

  if (fileMode === "jsonl") {
    syncTreeJsonl(text);
  } else {
    syncTreeJson(text);
  }
}

function syncTreeJson(text) {
  try {
    const parsed = JSON.parse(text);
    window.__currentParsedDoc = parsed;
    renderTree(parsed, elTreeContainer, onTreeEdit, onSortKeys);
  } catch (e) {
    elTreeError.textContent = e.message;
    elTreeContainer.textContent = "";
  }
}

function syncTreeJsonl(text) {
  const lines = text.split("\n");
  const entries = [];
  const errors = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { entries.push(undefined); continue; }
    try {
      entries.push(JSON.parse(line));
    } catch (e) {
      entries.push(undefined);
      errors.push(`Line ${i + 1}: ${e.message}`);
    }
  }

  window.__currentParsedDoc = entries;
  elTreeError.textContent = errors.join("\n");
  renderJsonlTree(entries, elTreeContainer, onJsonlTreeEdit, onSortKeys);
}

function dispatchText(text) {
  ignoreEditorChange = true;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
  });
  ignoreEditorChange = false;
}

function setEditorText(text) {
  dispatchText(text);
  setDirty(true);
}

function onTreeEdit(newJson) {
  setEditorText(JSON.stringify(newJson, null, 2));
}

function onJsonlTreeEdit(lineIndex, newLineValue) {
  const lines = view.state.doc.toString().split("\n");
  lines[lineIndex] = JSON.stringify(newLineValue);
  setEditorText(lines.join("\n"));
}

// ── JSONL helpers ─────────────────────────────────────────
function transformJsonlLines(text, fn) {
  return text.split("\n").map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    try {
      return fn(JSON.parse(trimmed));
    } catch { return line; }
  }).join("\n");
}

function onSortKeys(path, recursive) {
  const sortFn = recursive ? sortKeysDeep : sortKeysShallow;

  if (fileMode === "jsonl") {
    if (path.length === 0) {
      const text = view.state.doc.toString();
      replaceEditorContent(transformJsonlLines(text, parsed => JSON.stringify(sortFn(parsed))));
    } else {
      const text = view.state.doc.toString();
      const lines = text.split("\n");
      const lineIdx = path[0];
      const subPath = path.slice(1);
      const trimmed = lines[lineIdx].trim();
      if (trimmed) {
        try {
          const parsed = JSON.parse(trimmed);
          const target = getAtPath(parsed, subPath);
          if (typeof target === "object" && target !== null && !Array.isArray(target)) {
            lines[lineIdx] = JSON.stringify(applyEdit(parsed, subPath, sortFn(target)));
          }
        } catch {}
      }
      replaceEditorContent(lines.join("\n"));
    }
  } else {
    const root = window.__currentParsedDoc;
    const target = getAtPath(root, path);
    if (typeof target === "object" && target !== null && !Array.isArray(target)) {
      const newRoot = path.length === 0 ? sortFn(target) : applyEdit(root, path, sortFn(target));
      replaceEditorContent(JSON.stringify(newRoot, null, 2));
    }
  }
}

function replaceEditorContent(text) {
  setEditorText(text);
  syncTree();
}

// ── File I/O ───────────────────────────────────────────────
const fileTypes = [
  { description: "JSON files", accept: { "application/json": [".json"] } },
  { description: "JSON Lines files", accept: { "application/x-jsonlines": [".jsonl"] } },
];

function detectFileMode(name) {
  return name && name.endsWith(".jsonl") ? "jsonl" : "json";
}

function setContent(text, handle) {
  fileHandle = handle || null;
  fileMode = handle ? detectFileMode(handle.name) : "json";
  dispatchText(text);
  setDirty(false);
  elBtnSave.disabled = !fileHandle;
  elFileName.textContent = handle ? handle.name : "";
  syncTree();
}

async function openFile() {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: fileTypes,
      multiple: false,
    });
    const file = await handle.getFile();
    const text = await file.text();
    setContent(text, handle);
  } catch (e) {
    if (e.name !== "AbortError") console.error("Open failed:", e);
  }
}

async function saveFile() {
  if (!fileHandle) return saveFileAs();
  try {
    const writable = await fileHandle.createWritable();
    await writable.write(view.state.doc.toString());
    await writable.close();
    setDirty(false);
  } catch (e) {
    console.error("Save failed:", e);
  }
}

async function saveFileAs() {
  try {
    const defaultName = fileHandle ? fileHandle.name : (fileMode === "jsonl" ? "data.jsonl" : "data.json");
    const handle = await window.showSaveFilePicker({
      suggestedName: defaultName,
      types: fileTypes,
    });
    const writable = await handle.createWritable();
    await writable.write(view.state.doc.toString());
    await writable.close();
    fileHandle = handle;
    fileMode = detectFileMode(handle.name);
    elFileName.textContent = handle.name;
    setDirty(false);
    elBtnSave.disabled = false;
  } catch (e) {
    if (e.name !== "AbortError") console.error("Save As failed:", e);
  }
}

// ── Prettify / Minify ─────────────────────────────────────
function prettifyJSON() {
  const text = view.state.doc.toString();
  try {
    if (fileMode === "jsonl") {
      replaceEditorContent(transformJsonlLines(text, parsed => JSON.stringify(parsed)));
    } else {
      replaceEditorContent(JSON.stringify(JSON.parse(text), null, 2));
    }
  } catch {
    // Invalid JSON - leave it
  }
}

function minifyJSON() {
  const text = view.state.doc.toString();
  try {
    if (fileMode === "jsonl") {
      const result = transformJsonlLines(text, parsed => JSON.stringify(parsed));
      replaceEditorContent(result.split("\n").filter(line => line.trim()).join("\n"));
    } else {
      replaceEditorContent(JSON.stringify(JSON.parse(text)));
    }
  } catch {
    // Invalid JSON - leave it
  }
}

// ── Sort keys (global) ───────────────────────────────────
function sortAllKeys() {
  const text = view.state.doc.toString();
  try {
    if (fileMode === "jsonl") {
      replaceEditorContent(transformJsonlLines(text, parsed => JSON.stringify(sortKeysDeep(parsed))));
    } else {
      replaceEditorContent(JSON.stringify(sortKeysDeep(JSON.parse(text)), null, 2));
    }
  } catch {
    // Invalid JSON - leave it
  }
}

// ── Keyboard shortcuts ─────────────────────────────────────
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "o") {
    e.preventDefault();
    openFile();
  } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "s") {
    e.preventDefault();
    saveFile();
  } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") {
    e.preventDefault();
    saveFileAs();
  }
});

// ── Button wiring ──────────────────────────────────────────
elBtnOpen.addEventListener("click", openFile);
elBtnSave.addEventListener("click", saveFile);
elBtnSaveAs.addEventListener("click", saveFileAs);
elBtnPrettify.addEventListener("click", prettifyJSON);
elBtnMinify.addEventListener("click", minifyJSON);
elBtnSortKeys.addEventListener("click", sortAllKeys);

elBtnCollapse.addEventListener("click", () => {
  elTreeContainer.querySelectorAll(".tree-toggle.open").forEach(btn => btn.click());
});

elBtnExpand.addEventListener("click", () => {
  elTreeContainer.querySelectorAll(".tree-toggle:not(.open)").forEach(btn => btn.click());
});

// ── Splitter ───────────────────────────────────────────────
initSplitter(
  document.getElementById("splitter"),
  document.getElementById("tree-pane"),
);
