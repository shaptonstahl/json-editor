/**
 * tree.js — renders a JSON value as an interactive tree and supports
 * inline value editing that feeds back into the editor via onEdit().
 *
 * renderTree(value, container, onEdit, onSortKeys)
 *   value      — parsed JSON value (any type)
 *   container  — DOM element to render into
 *   onEdit     — callback(newRootValue) called when a value is changed
 *   onSortKeys — callback(path, recursive) called for sort-keys context menu
 *
 * renderJsonlTree(entries, container, onEdit, onSortKeys)
 *   entries    — array of parsed JSON values (one per JSONL line, undefined for blank/invalid)
 *   container  — DOM element to render into
 *   onEdit     — callback(lineIndex, newLineValue) called when a value is changed
 *   onSortKeys — callback(path, recursive) called for sort-keys context menu
 */

export function renderTree(value, container, onEdit, onSortKeys) {
  container.textContent = "";
  const ul = buildNode(value, null, null, [], onEdit, onSortKeys);
  container.appendChild(ul);
}

export function renderJsonlTree(entries, container, onEdit, onSortKeys) {
  container.textContent = "";
  const ul = document.createElement("ul");
  ul.className = "tree-node";

  entries.forEach((entry, i) => {
    if (entry === undefined) return;

    const lineOnEdit = (newRoot) => onEdit(i, newRoot);
    const lineOnSortKeys = (path, recursive) => onSortKeys([i, ...path], recursive);

    const isObject = typeof entry === "object" && entry !== null;

    const li = document.createElement("li");

    if (isObject) {
      renderBranch(li, entry, null, `Line ${i + 1}`, [], lineOnEdit, lineOnSortKeys);
    } else {
      const item = document.createElement("div");
      item.className = "tree-item";
      li.appendChild(item);

      const toggle = document.createElement("span");
      toggle.className = "tree-toggle open";
      item.appendChild(toggle);

      const label = document.createElement("span");
      label.className = "tree-index";
      label.textContent = `Line ${i + 1}`;
      item.appendChild(label);

      const valEl = document.createElement("span");
      valEl.className = `tree-value-${getType(entry)}`;
      valEl.textContent = formatValue(entry);
      item.appendChild(valEl);
    }

    ul.appendChild(li);
  });

  container.appendChild(ul);
}

function buildNode(value, key, index, path, onEdit, onSortKeys) {
  const ul = document.createElement("ul");
  ul.className = "tree-node";

  const li = document.createElement("li");
  ul.appendChild(li);

  if (value !== null && typeof value === "object") {
    renderBranch(li, value, key, index, path, onEdit, onSortKeys);
  } else {
    renderLeaf(li, value, key, index, path, onEdit);
  }

  return ul;
}

function renderBranch(li, value, key, index, path, onEdit, onSortKeys) {
  const isArray = Array.isArray(value);
  const entries = isArray ? value : Object.entries(value);
  const count = isArray ? value.length : entries.length;

  const item = document.createElement("div");
  item.className = "tree-item";
  li.appendChild(item);

  const toggle = document.createElement("span");
  toggle.className = "tree-toggle open";
  item.appendChild(toggle);

  appendLabel(item, key, index);

  const openBracket = document.createElement("span");
  openBracket.className = "tree-bracket";
  openBracket.textContent = isArray ? "[" : "{";
  item.appendChild(openBracket);

  const summary = document.createElement("span");
  summary.className = "tree-summary";
  summary.textContent = isArray
    ? `${count} item${count !== 1 ? "s" : ""}`
    : `${count} key${count !== 1 ? "s" : ""}`;
  summary.style.display = "none";
  item.appendChild(summary);

  const children = document.createElement("div");
  children.className = "tree-children";
  li.appendChild(children);

  if (isArray) {
    value.forEach((child, i) => {
      const childPath = [...path, i];
      const childNode = buildNode(child, null, i, childPath, onEdit, onSortKeys);
      children.appendChild(childNode);
    });
  } else {
    entries.forEach(([k, v]) => {
      const childPath = [...path, k];
      const childNode = buildNode(v, k, null, childPath, onEdit, onSortKeys);
      children.appendChild(childNode);
    });
  }

  const closingRow = document.createElement("div");
  closingRow.className = "tree-item";
  const indent = document.createElement("span");
  indent.className = "tree-leaf-indent";
  closingRow.appendChild(indent);
  const closeBracket = document.createElement("span");
  closeBracket.className = "tree-bracket";
  closeBracket.textContent = isArray ? "]" : "}";
  closingRow.appendChild(closeBracket);
  li.appendChild(closingRow);

  toggle.addEventListener("click", () => {
    const open = toggle.classList.toggle("open");
    children.style.display = open ? "" : "none";
    closingRow.style.display = open ? "" : "none";
    summary.style.display = open ? "none" : "";
    openBracket.textContent = open
      ? (isArray ? "[" : "{")
      : (isArray ? "[…]" : "{…}");
  });

  if (!isArray && onSortKeys) {
    addSortContextMenu(item, path, onSortKeys);
  }
}

function renderLeaf(li, value, key, index, path, onEdit) {
  const item = document.createElement("div");
  item.className = "tree-item";
  li.appendChild(item);

  const indent = document.createElement("span");
  indent.className = "tree-leaf-indent";
  item.appendChild(indent);

  appendLabel(item, key, index);

  const valEl = document.createElement("span");
  valEl.className = `tree-value-${getType(value)}`;
  valEl.textContent = formatValue(value);
  valEl.title = "Double-click to edit";
  item.appendChild(valEl);

  valEl.addEventListener("dblclick", () => {
    const input = document.createElement("input");
    input.type = "text";
    input.value = value === null ? "null" : JSON.stringify(value);
    input.style.cssText = `
      background: #3c3c3c; color: #d4d4d4; border: 1px solid #007acc;
      border-radius: 2px; padding: 0 4px; font-size: 12px;
      font-family: inherit; width: ${Math.max(80, valEl.textContent.length * 8)}px;
    `;

    item.replaceChild(input, valEl);
    input.focus();
    input.select();

    const commit = () => {
      let newVal;
      try {
        newVal = JSON.parse(input.value);
      } catch {
        newVal = input.value;
      }
      valEl.textContent = formatValue(newVal);
      valEl.className = `tree-value-${getType(newVal)}`;
      item.replaceChild(valEl, input);
      if (newVal !== value) {
        onEdit(applyEdit(window.__currentParsedDoc, path, newVal));
      }
    };

    const cancel = () => item.replaceChild(valEl, input);

    input.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      if (e.key === "Escape") cancel();
    });
    input.addEventListener("blur", commit);
  });
}

// ── Context menu for sort keys ────────────────────────────
let activeContextMenu = null;

function dismissContextMenu() {
  if (activeContextMenu) {
    activeContextMenu.remove();
    activeContextMenu = null;
  }
}

function addSortContextMenu(itemEl, path, onSortKeys) {
  itemEl.addEventListener("contextmenu", e => {
    e.preventDefault();
    dismissContextMenu();

    const menu = document.createElement("div");
    menu.className = "tree-context-menu";
    menu.style.left = e.clientX + "px";
    menu.style.top = e.clientY + "px";

    const sortHere = document.createElement("div");
    sortHere.className = "tree-context-menu-item";
    sortHere.textContent = "Sort keys";
    sortHere.addEventListener("click", () => {
      dismissContextMenu();
      onSortKeys(path, false);
    });
    menu.appendChild(sortHere);

    const sortRecursive = document.createElement("div");
    sortRecursive.className = "tree-context-menu-item";
    sortRecursive.textContent = "Sort keys (recursive)";
    sortRecursive.addEventListener("click", () => {
      dismissContextMenu();
      onSortKeys(path, true);
    });
    menu.appendChild(sortRecursive);

    document.body.appendChild(menu);
    activeContextMenu = menu;

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 4) + "px";
    if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 4) + "px";
  });
}

document.addEventListener("click", dismissContextMenu);
document.addEventListener("keydown", e => {
  if (e.key === "Escape") dismissContextMenu();
});

// ── Helpers ────────────────────────────────────────────────
function appendLabel(parent, key, index) {
  if (key !== null) {
    const keyEl = document.createElement("span");
    keyEl.className = "tree-key";
    keyEl.textContent = JSON.stringify(key);
    parent.appendChild(keyEl);
  } else if (index !== null) {
    const idxEl = document.createElement("span");
    idxEl.className = "tree-index";
    idxEl.textContent = index;
    parent.appendChild(idxEl);
  }
}

function getType(v) {
  if (v === null) return "null";
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return "number";
  return "string";
}

function formatValue(v) {
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  return String(v);
}

export function applyEdit(root, path, newVal) {
  if (path.length === 0) return newVal;

  const clone = Array.isArray(root) ? [...root] : { ...root };
  const [head, ...tail] = path;
  clone[head] = tail.length === 0 ? newVal : applyEdit(clone[head], tail, newVal);
  return clone;
}

export function getAtPath(obj, path) {
  let cur = obj;
  for (const key of path) cur = cur[key];
  return cur;
}
