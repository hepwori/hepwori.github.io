import { createEditor, getMarkdown, setMarkdownContent, getJSON, setJSONContent, wordCount } from "./editor.js";
import { newId, loadLibraryIndex, loadDoc, saveDoc, deleteDoc, getLastOpenId, setLastOpenId, loadConfig, saveConfig } from "./storage.js";
import { PROVIDERS } from "./llm/provider.js";

const STARTER_MARKDOWN = `# Untitled

Start writing here, or hit **Import…** to paste in a markdown draft.
`;

// Looked up before the editor is created: Tiptap fires onSelectionUpdate
// synchronously during construction, so anything that callback touches
// must already be initialized.
const toolbar = document.getElementById("toolbar");
const titleInput = document.getElementById("doc-title");
const saveStatusEl = document.getElementById("save-status");

let currentDocId = null;
let currentCreatedAt = null;
let saveTimer = null;

const editor = createEditor({
  element: document.getElementById("editor"),
  // A mark toggle (bold, etc.) is a doc-changing transaction but not
  // necessarily a selection change, so the toolbar's active-state needs
  // refreshing on both, not just onSelectionUpdate. Only onUpdate should
  // trigger an autosave — a selection move alone isn't a change to save.
  onUpdate: () => { syncUI(); scheduleSave(); },
  onSelectionUpdate: syncUI,
});

bootDoc();

function syncUI() {
  updateWordCount();
  updateToolbarState();
}

// ---- doc lifecycle (boot / new / open / delete) ----

function bootDoc() {
  const lastId = getLastOpenId();
  const existing = lastId && loadDoc(lastId);
  if (existing) {
    loadIntoEditor(existing);
  } else {
    startNewDoc();
  }
  syncUI();
}

function startNewDoc() {
  currentDocId = newId();
  currentCreatedAt = new Date().toISOString();
  titleInput.value = "Untitled";
  setMarkdownContent(editor, STARTER_MARKDOWN, { emitUpdate: false });
  setLastOpenId(currentDocId);
  persistNow();
  syncUI();
}

function loadIntoEditor(record) {
  currentDocId = record.id;
  currentCreatedAt = record.createdAt;
  titleInput.value = record.title || "Untitled";
  setJSONContent(editor, record.content, { emitUpdate: false });
  setLastOpenId(currentDocId);
  setSaveStatus("saved");
}

function scheduleSave() {
  setSaveStatus("saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 600);
}

function persistNow() {
  clearTimeout(saveTimer);
  saveDoc({
    id: currentDocId,
    title: titleInput.value.trim() || "Untitled",
    content: getJSON(editor),
    createdAt: currentCreatedAt,
  });
  setSaveStatus("saved");
}

function setSaveStatus(state) {
  saveStatusEl.textContent = state === "saving" ? "Saving…" : "Saved";
  saveStatusEl.classList.toggle("is-saving", state === "saving");
}

// Flush a pending debounced save before the tab actually goes away, so a
// close/switch within the 600ms window doesn't drop the last edit.
window.addEventListener("beforeunload", () => { if (saveTimer) persistNow(); });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && saveTimer) persistNow();
});

// ---- title ----

titleInput.addEventListener("input", scheduleSave);
titleInput.addEventListener("blur", () => {
  if (!titleInput.value.trim()) titleInput.value = "Untitled";
  persistNow();
});

// ---- library ----

const libraryModal = document.getElementById("library-modal");
const libraryList = document.getElementById("library-list");

document.getElementById("library-btn").addEventListener("click", () => {
  renderLibraryList();
  libraryModal.hidden = false;
});
document.getElementById("library-close-btn").addEventListener("click", () => {
  libraryModal.hidden = true;
});
libraryModal.addEventListener("click", (e) => {
  if (e.target === libraryModal) libraryModal.hidden = true;
});
document.getElementById("library-new-btn").addEventListener("click", () => {
  persistNow();
  startNewDoc();
  libraryModal.hidden = true;
});

function renderLibraryList() {
  const index = loadLibraryIndex();
  const docs = [...index.docs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  libraryList.innerHTML = "";
  if (docs.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No saved docs yet.";
    libraryList.appendChild(li);
    return;
  }
  for (const d of docs) {
    const li = document.createElement("li");
    li.className = "library-row" + (d.id === currentDocId ? " is-current" : "");

    const openBtn = document.createElement("button");
    openBtn.className = "library-open";
    const titleSpan = document.createElement("span");
    titleSpan.className = "library-title";
    titleSpan.textContent = d.title || "Untitled";
    const timeSpan = document.createElement("span");
    timeSpan.className = "library-time";
    timeSpan.textContent = relativeTime(d.updatedAt);
    openBtn.append(titleSpan, timeSpan);
    openBtn.addEventListener("click", () => openDoc(d.id));

    const delBtn = document.createElement("button");
    delBtn.className = "library-delete";
    delBtn.title = "Delete";
    delBtn.textContent = "×";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!window.confirm(`Delete "${d.title || "Untitled"}"? This can't be undone.`)) return;
      deleteDoc(d.id);
      if (d.id === currentDocId) startNewDoc();
      renderLibraryList();
    });

    li.append(openBtn, delBtn);
    libraryList.appendChild(li);
  }
}

function openDoc(id) {
  if (id !== currentDocId) {
    persistNow();
    const record = loadDoc(id);
    if (record) loadIntoEditor(record);
    syncUI();
  }
  libraryModal.hidden = true;
}

function relativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ---- settings (LLM connection) ----

const settingsModal = document.getElementById("settings-modal");
let config = loadConfig();

document.getElementById("settings-btn").addEventListener("click", () => {
  renderSettings();
  settingsModal.hidden = false;
});
document.getElementById("settings-close-btn").addEventListener("click", () => {
  settingsModal.hidden = true;
});
settingsModal.addEventListener("click", (e) => {
  if (e.target === settingsModal) settingsModal.hidden = true;
});

function renderSettings() {
  for (const radio of settingsModal.querySelectorAll('input[name="active-provider"]')) {
    radio.checked = radio.value === config.activeProvider;
  }
  for (const section of settingsModal.querySelectorAll(".provider-config")) {
    const id = section.dataset.provider;
    section.querySelector(".api-key-input").value = config[id].apiKey || "";
    section.querySelector(".model-input").value = config[id].model || PROVIDERS[id].defaultModel || "";
    section.querySelector(".model-input").placeholder = PROVIDERS[id].defaultModel || "";
    section.querySelector(".api-key-input").placeholder = PROVIDERS[id].keyPlaceholder || "";
    const status = section.querySelector(".test-status");
    status.textContent = "";
    status.className = "test-status";
  }
}

settingsModal.querySelectorAll('input[name="active-provider"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    config.activeProvider = radio.value;
    saveConfig(config);
  });
});

settingsModal.querySelectorAll(".provider-config").forEach((section) => {
  const id = section.dataset.provider;
  const keyInput = section.querySelector(".api-key-input");
  const modelInput = section.querySelector(".model-input");
  const testBtn = section.querySelector(".test-btn");
  const status = section.querySelector(".test-status");

  const persist = () => {
    config[id] = { apiKey: keyInput.value, model: modelInput.value };
    saveConfig(config);
  };
  keyInput.addEventListener("input", persist);
  modelInput.addEventListener("input", persist);

  testBtn.addEventListener("click", async () => {
    persist();
    testBtn.disabled = true;
    status.className = "test-status";
    status.textContent = "Testing…";
    try {
      const result = await PROVIDERS[id].testConnection({
        apiKey: keyInput.value,
        model: modelInput.value || PROVIDERS[id].defaultModel,
      });
      status.className = "test-status ok";
      status.textContent = `Connected — replied "${result.reply}"`;
    } catch (err) {
      status.className = "test-status error";
      status.textContent = err.message || "Connection failed";
    } finally {
      testBtn.disabled = false;
    }
  });
});

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
  syncUI();
  scheduleSave();
  importModal.hidden = true;
  showToast("Markdown imported");
});
importModal.addEventListener("click", (e) => {
  if (e.target === importModal) importModal.hidden = true;
});

// ---- keyboard shortcuts ----

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    // Generic: closes whichever .modal (import, library, ...) is open.
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
