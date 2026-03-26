import { EditorView, keymap, highlightActiveLine, lineNumbers, highlightActiveLineGutter, drawSelection } from "../lib/codemirror/cm-view.js";
import { EditorState, Compartment } from "../lib/codemirror/cm-state.js";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "../lib/codemirror/cm-commands.js";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentOnInput } from "../lib/codemirror/cm-language.js";
import { searchKeymap, highlightSelectionMatches } from "../lib/codemirror/cm-search.js";
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from "../lib/codemirror/cm-autocomplete.js";
import { lintKeymap } from "../lib/codemirror/cm-lint.js";
import { json } from "../lib/codemirror/cm-lang-json.js";
import { renderTree } from "./tree.js";
import { initSplitter } from "./splitter.js";

// ── State ──────────────────────────────────────────────────
let fileHandle = null;
let isDirty = false;
let ignoreEditorChange = false;
let treeDebounceTimer = null;

const elFileName    = document.getElementById("file-name");
const elDirty       = document.getElementById("dirty-indicator");
const elBtnSave     = document.getElementById("btn-save");
const elBtnOpen     = document.getElementById("btn-open");
const elBtnSaveAs   = document.getElementById("btn-save-as");
const elBtnFormat   = document.getElementById("btn-format");
const elBtnCollapse = document.getElementById("btn-collapse-all");
const elBtnExpand   = document.getElementById("btn-expand-all");
const elTreeContainer = document.getElementById("tree-container");
const elTreeError     = document.getElementById("tree-error");
const elEditorContainer = document.getElementById("editor-container");

// ── CodeMirror setup ───────────────────────────────────────
const themeCompartment = new Compartment();

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

// ── Tree sync ──────────────────────────────────────────────
function scheduleTreeUpdate() {
  clearTimeout(treeDebounceTimer);
  treeDebounceTimer = setTimeout(syncTree, 300);
}

function syncTree() {
  const text = view.state.doc.toString();
  elTreeError.textContent = "";

  if (!text.trim()) {
    elTreeContainer.innerHTML = "";
    return;
  }

  try {
    const parsed = JSON.parse(text);
    window.__currentParsedDoc = parsed;
    renderTree(parsed, elTreeContainer, onTreeEdit);
  } catch (e) {
    elTreeError.textContent = e.message;
    elTreeContainer.innerHTML = "";
  }
}

// Called by tree when an inline edit is confirmed
function onTreeEdit(newJson) {
  const formatted = JSON.stringify(newJson, null, 2);
  ignoreEditorChange = true;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: formatted },
  });
  ignoreEditorChange = false;
  setDirty(true);
}

// ── File I/O ───────────────────────────────────────────────
function setContent(text, handle) {
  fileHandle = handle || null;
  ignoreEditorChange = true;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
  });
  ignoreEditorChange = false;
  setDirty(false);
  elBtnSave.disabled = !fileHandle;
  elFileName.textContent = handle ? handle.name : "";
  syncTree();
}

async function openFile() {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: "JSON files", accept: { "application/json": [".json"] } }],
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
    const handle = await window.showSaveFilePicker({
      suggestedName: (fileHandle ? fileHandle.name : "data.json"),
      types: [{ description: "JSON files", accept: { "application/json": [".json"] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(view.state.doc.toString());
    await writable.close();
    fileHandle = handle;
    elFileName.textContent = handle.name;
    setDirty(false);
    elBtnSave.disabled = false;
  } catch (e) {
    if (e.name !== "AbortError") console.error("Save As failed:", e);
  }
}

function formatJSON() {
  const text = view.state.doc.toString();
  try {
    const formatted = JSON.stringify(JSON.parse(text), null, 2);
    ignoreEditorChange = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: formatted },
    });
    ignoreEditorChange = false;
    setDirty(true);
    syncTree();
  } catch (e) {
    // Invalid JSON - just leave it
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
elBtnFormat.addEventListener("click", formatJSON);

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
