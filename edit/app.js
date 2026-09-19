import { createEditor, getMarkdown, setMarkdownContent, wordCount } from "./editor.js";

const STARTER_MARKDOWN = `# Untitled

Start writing here, or hit **Import…** to paste in a markdown draft.
`;

// Looked up before the editor is created: Tiptap fires onSelectionUpdate
// synchronously during construction, so anything that callback touches
// must already be initialized.
const toolbar = document.getElementById("toolbar");

const editor = createEditor({
  element: document.getElementById("editor"),
  // A mark toggle (bold, etc.) is a doc-changing transaction but not
  // necessarily a selection change, so the toolbar's active-state needs
  // refreshing on both, not just onSelectionUpdate.
  onUpdate: syncUI,
  onSelectionUpdate: syncUI,
});
setMarkdownContent(editor, STARTER_MARKDOWN);
syncUI();

function syncUI() {
  updateWordCount();
  updateToolbarState();
}

// ---- toolbar ----

toolbar.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-cmd]");
  if (!btn) return;
  const cmd = btn.dataset.cmd;
  const attrs = btn.dataset.attrs ? JSON.parse(btn.dataset.attrs) : undefined;
  const chain = editor.chain().focus();
  if (attrs) chain[cmd](attrs).run();
  else chain[cmd]().run();
});

function updateToolbarState() {
  for (const btn of toolbar.querySelectorAll("button[data-cmd]")) {
    const cmd = btn.dataset.cmd;
    const attrs = btn.dataset.attrs ? JSON.parse(btn.dataset.attrs) : undefined;
    const name = cmd.replace(/^toggle/, "").replace(/^./, (c) => c.toLowerCase());
    let active = false;
    try {
      active = attrs ? editor.isActive(name, attrs) : editor.isActive(name);
    } catch {
      active = false;
    }
    btn.classList.toggle("is-active", active);
  }
}

document.getElementById("link-btn").addEventListener("click", () => {
  const prev = editor.getAttributes("link").href;
  const url = window.prompt("Link URL", prev || "https://");
  if (url === null) return;
  if (url === "") {
    editor.chain().focus().unsetLink().run();
  } else {
    editor.chain().focus().setLink({ href: url }).run();
  }
});

// ---- word count ----

function updateWordCount() {
  const n = wordCount(editor);
  document.getElementById("word-count").textContent = `${n} word${n === 1 ? "" : "s"}`;
}

// ---- copy as markdown ----

document.getElementById("copy-md-btn").addEventListener("click", async () => {
  const md = getMarkdown(editor);
  try {
    await navigator.clipboard.writeText(md);
    showToast("Copied markdown to clipboard");
  } catch {
    showToast("Couldn't access clipboard — select and copy manually");
  }
});

// ---- import markdown ----

const importModal = document.getElementById("import-modal");
const importTextarea = document.getElementById("import-textarea");

document.getElementById("import-md-btn").addEventListener("click", () => {
  importTextarea.value = "";
  importModal.hidden = false;
  importTextarea.focus();
});
document.getElementById("import-cancel-btn").addEventListener("click", () => {
  importModal.hidden = true;
});
document.getElementById("import-load-btn").addEventListener("click", () => {
  setMarkdownContent(editor, importTextarea.value);
  updateWordCount();
  importModal.hidden = true;
  showToast("Markdown imported");
});
importModal.addEventListener("click", (e) => {
  if (e.target === importModal) importModal.hidden = true;
});

// ---- title ----

document.getElementById("doc-title").addEventListener("blur", (e) => {
  if (!e.target.value.trim()) e.target.value = "Untitled";
});

// ---- keyboard shortcuts ----

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    // Generic: closes whichever .modal (import, settings, ...) is open.
    for (const modal of document.querySelectorAll(".modal:not([hidden])")) {
      modal.hidden = true;
    }
    return;
  }
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return;
  if (e.key.toLowerCase() === "k") {
    e.preventDefault();
    document.getElementById("link-btn").click();
  } else if (e.shiftKey && e.key.toLowerCase() === "c") {
    e.preventDefault();
    document.getElementById("copy-md-btn").click();
  }
});

// ---- toast ----

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => { el.hidden = true; }, 200);
  }, 1800);
}
