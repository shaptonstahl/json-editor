/**
 * splitter.js — drag-to-resize the tree pane.
 *
 * initSplitter(splitterEl, treePaneEl)
 */

const STORAGE_KEY = "json-editor-split";

export function initSplitter(splitterEl, treePaneEl) {
  // Restore saved width
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) treePaneEl.style.width = saved + "px";

  let dragging = false;
  let startX = 0;
  let startW = 0;

  splitterEl.addEventListener("mousedown", e => {
    dragging = true;
    startX = e.clientX;
    startW = treePaneEl.getBoundingClientRect().width;
    splitterEl.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  });

  document.addEventListener("mousemove", e => {
    if (!dragging) return;
    const delta = e.clientX - startX;
    const newW = Math.max(120, Math.min(startW + delta, window.innerWidth * 0.8));
    treePaneEl.style.width = newW + "px";
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    splitterEl.classList.remove("dragging");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    localStorage.setItem(STORAGE_KEY, parseInt(treePaneEl.style.width));
  });
}
