/**
 * tree.js — renders a JSON value as an interactive tree and supports
 * inline value editing that feeds back into the editor via onEdit().
 *
 * renderTree(value, container, onEdit)
 *   value     — parsed JSON value (any type)
 *   container — DOM element to render into
 *   onEdit    — callback(newRootValue) called when a value is changed
 */

export function renderTree(value, container, onEdit) {
  container.innerHTML = "";
  const ul = buildNode(value, null, null, [], onEdit);
  container.appendChild(ul);
}

// ── Internal path tracking ─────────────────────────────────
// path is an array of keys/indices from root to this node

function buildNode(value, key, index, path, onEdit) {
  const ul = document.createElement("ul");
  ul.className = "tree-node";

  const li = document.createElement("li");
  ul.appendChild(li);

  if (value !== null && typeof value === "object") {
    renderBranch(li, value, key, index, path, onEdit);
  } else {
    renderLeaf(li, value, key, index, path, onEdit);
  }

  return ul;
}

function renderBranch(li, value, key, index, path, onEdit) {
  const isArray = Array.isArray(value);
  const entries = isArray ? value : Object.entries(value);
  const count = isArray ? value.length : entries.length;

  const item = document.createElement("div");
  item.className = "tree-item";
  li.appendChild(item);

  // Toggle button
  const toggle = document.createElement("span");
  toggle.className = "tree-toggle open";
  item.appendChild(toggle);

  // Key or index label
  if (key !== null) {
    const keyEl = document.createElement("span");
    keyEl.className = "tree-key";
    keyEl.textContent = JSON.stringify(key);
    item.appendChild(keyEl);
  } else if (index !== null) {
    const idxEl = document.createElement("span");
    idxEl.className = "tree-index";
    idxEl.textContent = index;
    item.appendChild(idxEl);
  }

  // Opening bracket
  const openBracket = document.createElement("span");
  openBracket.className = "tree-bracket";
  openBracket.textContent = isArray ? "[" : "{";
  item.appendChild(openBracket);

  // Summary (shown when collapsed)
  const summary = document.createElement("span");
  summary.className = "tree-summary";
  summary.textContent = isArray
    ? `${count} item${count !== 1 ? "s" : ""}`
    : `${count} key${count !== 1 ? "s" : ""}`;
  summary.style.display = "none";
  item.appendChild(summary);

  // Children container
  const children = document.createElement("div");
  children.className = "tree-children";
  li.appendChild(children);

  // Render children
  if (isArray) {
    value.forEach((child, i) => {
      const childPath = [...path, i];
      const childNode = buildNode(child, null, i, childPath, onEdit);
      children.appendChild(childNode);
    });
  } else {
    entries.forEach(([k, v]) => {
      const childPath = [...path, k];
      const childNode = buildNode(v, k, null, childPath, onEdit);
      children.appendChild(childNode);
    });
  }

  // Closing bracket row
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

  // Toggle open/closed
  toggle.addEventListener("click", () => {
    const open = toggle.classList.toggle("open");
    children.style.display = open ? "" : "none";
    closingRow.style.display = open ? "" : "none";
    summary.style.display = open ? "none" : "";
    openBracket.textContent = open
      ? (isArray ? "[" : "{")
      : (isArray ? "[…]" : "{…}");
  });
}

function renderLeaf(li, value, key, index, path, onEdit) {
  const item = document.createElement("div");
  item.className = "tree-item";
  li.appendChild(item);

  // Indent placeholder (no toggle button)
  const indent = document.createElement("span");
  indent.className = "tree-leaf-indent";
  item.appendChild(indent);

  // Key or index label
  if (key !== null) {
    const keyEl = document.createElement("span");
    keyEl.className = "tree-key";
    keyEl.textContent = JSON.stringify(key);
    item.appendChild(keyEl);
  } else if (index !== null) {
    const idxEl = document.createElement("span");
    idxEl.className = "tree-index";
    idxEl.textContent = index;
    item.appendChild(idxEl);
  }

  // Value (editable)
  const valEl = document.createElement("span");
  valEl.className = `tree-value-${getType(value)}`;
  valEl.textContent = formatValue(value);
  valEl.title = "Double-click to edit";
  item.appendChild(valEl);

  // Inline editing on double-click
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
        // Treat as string if parse fails
        newVal = input.value;
      }
      valEl.textContent = formatValue(newVal);
      valEl.className = `tree-value-${getType(newVal)}`;
      item.replaceChild(valEl, input);
      if (newVal !== value) {
        onEdit(applyEdit(getRootFromTree(li), path, newVal));
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

// ── Helpers ────────────────────────────────────────────────
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

/**
 * Walk up the DOM to find the root tree-container, then extract the
 * current JSON value from it so we can apply the edit.
 */
function getRootFromTree(startEl) {
  let el = startEl;
  while (el && el.id !== "tree-container") el = el.parentElement;
  // Re-parse from the editor via DOM traversal is complex.
  // Instead, we read from the CodeMirror doc via a shared reference.
  // We use the window-level currentDoc set by editor.js.
  return window.__currentParsedDoc;
}

/**
 * Return a deep copy of root with the value at path replaced by newVal.
 */
function applyEdit(root, path, newVal) {
  if (path.length === 0) return newVal;

  const clone = Array.isArray(root) ? [...root] : { ...root };
  const [head, ...tail] = path;
  clone[head] = tail.length === 0 ? newVal : applyEdit(clone[head], tail, newVal);
  return clone;
}
