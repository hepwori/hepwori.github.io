import { createEditor, getMarkdown, setMarkdownContent, getJSON, setJSONContent, wordCount } from "./editor.js";
import { newId, loadLibraryIndex, loadDoc, saveDoc, deleteDoc, getLastOpenId, setLastOpenId, loadConfig, saveConfig, uniqueSlug, findIdBySlug } from "./storage.js";
import { PROVIDERS } from "./llm/provider.js";
import { PASS_LIBRARY, runReviewPass, listFindings, resolveFinding, dismissAllFindings, focusFinding } from "./review.js";
import { setDocFavicon } from "./favicon.js";
import { passBg, passFg } from "./passColors.js";
import { generateOutline, outlineToMarkdown } from "./generative.js";

const STARTER_MARKDOWN = `# Untitled

Start writing here, or hit **Import…** to paste in a markdown draft.
`;

// Looked up before the editor is created: Tiptap fires onSelectionUpdate
// synchronously during construction, so anything that callback touches
// (via syncUI, below) must already be initialized. This bit us once
// already (see CLAUDE.md) — every element syncUI's callees touch has to
// live in this block, not down by the rest of its section's wiring.
const toolbar = document.getElementById("toolbar");
const titleInput = document.getElementById("doc-title");
const saveStatusEl = document.getElementById("save-status");
const reviewPanel = document.getElementById("review-panel");
const reviewScopeNote = document.getElementById("review-scope-note");

let currentDocId = null;
let currentCreatedAt = null;
let currentSlug = null;
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
  updateReviewScopeNote();
}

// ---- doc lifecycle (boot / new / open / delete) ----

function bootDoc() {
  // A doc link (edit/#/<slug>) wins over "resume where I left off" — that's
  // the whole point of following one.
  const hashSlug = getSlugFromHash();
  const targetId = (hashSlug && findIdBySlug(hashSlug)) || getLastOpenId();
  const existing = targetId && loadDoc(targetId);
  if (existing) {
    loadIntoEditor(existing);
  } else {
    startNewDoc();
  }
  syncUI();
}

// Following a doc link while this tab already has a different doc open
// (pasted into the address bar, or clicked from elsewhere) navigates live
// instead of doing nothing until the next reload.
window.addEventListener("hashchange", () => {
  const hashSlug = getSlugFromHash();
  const targetId = hashSlug && findIdBySlug(hashSlug);
  if (!targetId || targetId === currentDocId) return;
  const record = loadDoc(targetId);
  if (!record) return;
  persistNow();
  loadIntoEditor(record);
  syncUI();
});

// markdown/title overrides let the generative-outline flow (below) reuse
// this exact same doc-creation path instead of duplicating it.
function startNewDoc(markdown = STARTER_MARKDOWN, title = "Untitled") {
  currentDocId = newId();
  currentCreatedAt = new Date().toISOString();
  currentSlug = uniqueSlug(title);
  titleInput.value = title;
  setMarkdownContent(editor, markdown, { emitUpdate: false });
  setLastOpenId(currentDocId);
  setDocFavicon(currentDocId);
  persistNow();
  syncUI();
}

function loadIntoEditor(record) {
  currentDocId = record.id;
  currentCreatedAt = record.createdAt;
  // Backfills a slug for docs saved before this feature existed.
  currentSlug = record.slug || uniqueSlug(record.title || "Untitled", record.id);
  titleInput.value = record.title || "Untitled";
  setJSONContent(editor, record.content, { emitUpdate: false });
  setLastOpenId(currentDocId);
  setDocFavicon(currentDocId);
  updateLocationHash();
  if (!record.slug) saveDoc({ ...record, slug: currentSlug });
  setSaveStatus("saved");
}

function scheduleSave() {
  setSaveStatus("saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 600);
}

function persistNow() {
  clearTimeout(saveTimer);
  const title = titleInput.value.trim() || "Untitled";
  // The slug locks in once the doc gets a real title, so a link to it
  // keeps working through later renames. Until then (still "Untitled"),
  // it stays a placeholder like "untitled-2" and is free to upgrade.
  if (title !== "Untitled" && (!currentSlug || /^untitled(-\d+)?$/.test(currentSlug))) {
    currentSlug = uniqueSlug(title, currentDocId);
  }
  saveDoc({
    id: currentDocId,
    title,
    slug: currentSlug,
    content: getJSON(editor),
    createdAt: currentCreatedAt,
  });
  setSaveStatus("saved");
  updateLocationHash();
}

function getSlugFromHash() {
  const m = location.hash.match(/^#\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function updateLocationHash() {
  if (!currentSlug) return;
  const newHash = "#/" + encodeURIComponent(currentSlug);
  if (location.hash !== newHash) history.replaceState(null, "", newHash);
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

// ---- generative outline mode ----

const generateModal = document.getElementById("generate-modal");
const generateTextarea = document.getElementById("generate-textarea");
const generateStatus = document.getElementById("generate-status");
const generateGoBtn = document.getElementById("generate-go-btn");

document.getElementById("library-generate-btn").addEventListener("click", () => {
  libraryModal.hidden = true;
  generateTextarea.value = "";
  generateStatus.hidden = true;
  generateModal.hidden = false;
  generateTextarea.focus();
});
document.getElementById("generate-cancel-btn").addEventListener("click", () => {
  generateModal.hidden = true;
});
generateModal.addEventListener("click", (e) => {
  if (e.target === generateModal) generateModal.hidden = true;
});

generateGoBtn.addEventListener("click", async () => {
  const description = generateTextarea.value.trim();
  if (!description) return;

  const providerId = config.activeProvider;
  const providerConfig = config[providerId];
  const providerLabel = PROVIDERS[providerId]?.label || providerId;
  if (!providerConfig?.apiKey) {
    setGenerateStatus(`No API key set for ${providerLabel} — open Settings to add one.`, true);
    return;
  }

  setGenerateStatus(`Asking ${providerLabel}…`, false, true);
  generateGoBtn.disabled = true;
  try {
    const outline = await generateOutline({
      providerId,
      apiKey: providerConfig.apiKey,
      model: providerConfig.model,
      description,
    });
    if (!outline.headings.length) throw new Error("Got back no headings to work with — try describing it a bit differently.");
    persistNow(); // flush whatever doc is currently open before switching away
    startNewDoc(outlineToMarkdown(outline), outline.title || "Untitled");
    generateModal.hidden = true;
    showToast("Outline generated");
  } catch (err) {
    setGenerateStatus(err.message || "Couldn't generate an outline", true);
  } finally {
    generateGoBtn.disabled = false;
  }
});

function setGenerateStatus(text, isError, isBusy) {
  generateStatus.textContent = text;
  generateStatus.hidden = !text;
  generateStatus.classList.toggle("is-error", Boolean(isError));
  generateStatus.classList.toggle("is-busy", Boolean(isBusy));
}

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

// ---- review ----

const passChipsEl = document.getElementById("pass-chips");
const customInstructionInput = document.getElementById("custom-instruction-input");
const reviewStatus = document.getElementById("review-status");
const findingsListEl = document.getElementById("findings-list");
const reviewBtn = document.getElementById("review-btn");
const dismissAllBtn = document.getElementById("dismiss-all-btn");

dismissAllBtn.addEventListener("click", () => {
  const n = dismissAllFindings(editor);
  if (n > 0) {
    persistNow();
    renderFindings();
    setReviewStatus(`Dismissed ${n}.`, false);
  }
});

for (const pass of PASS_LIBRARY) {
  const chip = document.createElement("button");
  chip.className = "pass-chip";
  chip.type = "button";
  chip.textContent = pass.label;
  chip.addEventListener("click", () => runPass({ passId: pass.id, passLabel: pass.label, instruction: pass.instruction, triggerEl: chip }));
  passChipsEl.appendChild(chip);
}

// ---- review panel resize (dragged width persists) ----

const REVIEW_WIDTH_KEY = "edit.reviewPanelWidth.v1";
const storedReviewWidth = parseInt(localStorage.getItem(REVIEW_WIDTH_KEY), 10);
if (storedReviewWidth) reviewPanel.style.setProperty("--review-panel-width", storedReviewWidth + "px");

const reviewResizeHandle = document.getElementById("review-resize-handle");
reviewResizeHandle.addEventListener("mousedown", (e) => {
  e.preventDefault();
  const startX = e.clientX;
  const startWidth = reviewPanel.getBoundingClientRect().width;
  reviewResizeHandle.classList.add("is-dragging");
  document.body.style.userSelect = "none";

  const onMove = (moveEvent) => {
    const delta = startX - moveEvent.clientX; // handle is on the left edge
    const newWidth = Math.min(720, Math.max(300, Math.round(startWidth + delta)));
    reviewPanel.style.setProperty("--review-panel-width", newWidth + "px");
  };
  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    reviewResizeHandle.classList.remove("is-dragging");
    document.body.style.userSelect = "";
    localStorage.setItem(REVIEW_WIDTH_KEY, Math.round(reviewPanel.getBoundingClientRect().width));
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
});

reviewBtn.addEventListener("click", () => {
  const willShow = reviewPanel.hidden;
  reviewPanel.hidden = !willShow;
  reviewBtn.classList.toggle("is-active", willShow);
  if (willShow) {
    updateReviewScopeNote();
    renderFindings();
  }
});
document.getElementById("review-close-btn").addEventListener("click", () => {
  reviewPanel.hidden = true;
  reviewBtn.classList.remove("is-active");
});

document.getElementById("run-custom-btn").addEventListener("click", runCustomInstruction);
customInstructionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runCustomInstruction();
});

function runCustomInstruction() {
  const instruction = customInstructionInput.value.trim();
  if (!instruction) return;
  const passId = `custom-${Date.now().toString(36)}`;
  const passLabel = instruction.length > 44 ? instruction.slice(0, 43) + "…" : instruction;
  const runBtn = document.getElementById("run-custom-btn");
  runPass({ passId, passLabel, instruction, triggerEl: runBtn }).then((ok) => {
    if (ok) customInstructionInput.value = "";
  });
}

// Every status line names the pass and, when relevant, the scope it ran
// against — "Nothing flagged" on its own doesn't say nothing flagged
// *about what*.
async function runPass({ passId, passLabel, instruction, triggerEl }) {
  const providerId = config.activeProvider;
  const providerConfig = config[providerId];
  const providerLabel = PROVIDERS[providerId]?.label || providerId;
  if (!providerConfig?.apiKey) {
    setReviewStatus(`${passLabel}: no API key set for ${providerLabel} — open Settings to add one.`, true);
    return false;
  }

  const scopedAtStart = !editor.state.selection.empty;
  setReviewStatus(`${passLabel}: asking ${providerLabel}${scopedAtStart ? " about your selection" : ""}…`, false, true);
  setChipsDisabled(true, triggerEl);
  try {
    const result = await runReviewPass({
      editor,
      providerId,
      apiKey: providerConfig.apiKey,
      model: providerConfig.model,
      instruction,
      passId,
      passLabel,
    });
    persistNow();
    renderFindings();
    const scopeNote = result.scoped ? " (scoped to your selection)" : "";
    if (result.total === 0) {
      setReviewStatus(`${passLabel}: nothing flagged${scopeNote} — looks clean.`, false);
    } else if (result.skipped > 0) {
      setReviewStatus(`${passLabel}: found ${result.applied} of ${result.total}${scopeNote} — ${result.skipped} couldn't be matched back to exact text and were skipped.`, false);
    } else {
      setReviewStatus(`${passLabel}: found ${result.applied}${scopeNote}.`, false);
    }
    return true;
  } catch (err) {
    setReviewStatus(`${passLabel}: ${err.message || "review pass failed"}`, true);
    return false;
  } finally {
    setChipsDisabled(false);
  }
}

// While a pass is in flight: the chip (or Run button) that triggered it
// pulses so it's obvious *which* review is running, everything else that
// could start another one is disabled so two runs can't race against the
// same editor state.
function setChipsDisabled(disabled, activeEl) {
  for (const chip of passChipsEl.querySelectorAll(".pass-chip")) {
    chip.disabled = disabled;
    chip.classList.toggle("is-running", disabled && chip === activeEl);
  }
  const runBtn = document.getElementById("run-custom-btn");
  runBtn.disabled = disabled;
  runBtn.classList.toggle("is-running", disabled && runBtn === activeEl);
  customInstructionInput.disabled = disabled;
  dismissAllBtn.disabled = disabled;
}

function setReviewStatus(text, isError, isBusy) {
  reviewStatus.textContent = text;
  reviewStatus.hidden = !text;
  reviewStatus.classList.toggle("is-error", Boolean(isError));
  reviewStatus.classList.toggle("is-busy", Boolean(isBusy));
}

function updateReviewScopeNote() {
  if (reviewPanel.hidden) return;
  const { empty, from, to } = editor.state.selection;
  if (empty) {
    reviewScopeNote.hidden = true;
    return;
  }
  const text = editor.state.doc.textBetween(from, to, " ", " ").trim();
  if (!text) {
    reviewScopeNote.hidden = true;
    return;
  }
  const preview = text.length > 80 ? text.slice(0, 79) + "…" : text;
  reviewScopeNote.innerHTML = "";
  const strong = document.createElement("strong");
  strong.textContent = "Scoped to your selection: ";
  reviewScopeNote.append(strong, document.createTextNode(`“${preview}”`));
  reviewScopeNote.hidden = false;
}

function renderFindings() {
  const findings = listFindings(editor);
  dismissAllBtn.hidden = findings.length === 0;
  findingsListEl.innerHTML = "";
  if (findings.length === 0) {
    const empty = document.createElement("div");
    empty.className = "findings-empty";
    empty.textContent = "No findings yet — run a pass above.";
    findingsListEl.appendChild(empty);
    return;
  }

  const groups = new Map();
  for (const f of findings) {
    if (!groups.has(f.passId)) groups.set(f.passId, { label: f.passLabel, items: [] });
    groups.get(f.passId).items.push(f);
  }

  for (const [passId, { label, items }] of groups) {
    const group = document.createElement("div");
    group.className = "findings-group";

    const header = document.createElement("div");
    header.className = "findings-group-header";
    const dot = document.createElement("span");
    dot.className = "pass-color-dot";
    dot.style.background = passFg(passId, label);
    header.append(dot, document.createTextNode(label));
    const count = document.createElement("span");
    count.className = "findings-group-count";
    count.textContent = `· ${items.length} open`;
    header.appendChild(count);
    group.appendChild(header);

    for (const finding of items) {
      group.appendChild(buildFindingCard(finding));
    }
    findingsListEl.appendChild(group);
  }
}

function buildFindingCard(finding) {
  const card = document.createElement("div");
  card.className = "finding-card";
  card.dataset.findingId = finding.id;
  card.style.background = passBg(finding.passId, finding.passLabel);
  card.style.borderLeftColor = passFg(finding.passId, finding.passLabel);

  if (finding.category) {
    const cat = document.createElement("div");
    cat.className = "finding-category";
    cat.style.color = passFg(finding.passId, finding.passLabel);
    cat.textContent = finding.category;
    card.appendChild(cat);
  }

  const note = document.createElement("div");
  note.className = "finding-note";
  note.textContent = finding.note || "";
  card.appendChild(note);

  // Editable in place — a tweak here before hitting Accept is what
  // actually lands (see resolveFinding's suggestionText override).
  let sugInput = null;
  if (finding.suggestion) {
    sugInput = document.createElement("textarea");
    sugInput.className = "finding-suggestion";
    sugInput.value = finding.suggestion;
    sugInput.rows = 1;
    sugInput.spellcheck = false;
    sugInput.addEventListener("click", (e) => e.stopPropagation());
    sugInput.addEventListener("input", () => autosizeTextarea(sugInput));
    card.appendChild(sugInput);
    requestAnimationFrame(() => autosizeTextarea(sugInput));
  }

  const actions = document.createElement("div");
  actions.className = "finding-actions";

  const acceptBtn = document.createElement("button");
  acceptBtn.className = "primary small";
  acceptBtn.textContent = finding.suggestion ? "Accept" : "Resolve";
  acceptBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    resolveFinding(editor, finding.id, {
      applySuggestion: Boolean(finding.suggestion),
      suggestionText: sugInput?.value,
    });
    persistNow();
    renderFindings();
  });

  const dismissBtn = document.createElement("button");
  dismissBtn.className = "small";
  dismissBtn.textContent = "Dismiss";
  dismissBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    resolveFinding(editor, finding.id);
    persistNow();
    renderFindings();
  });

  actions.append(acceptBtn, dismissBtn);
  card.appendChild(actions);

  card.addEventListener("click", () => {
    focusFinding(editor, finding.id);
    highlightCard(finding.id);
  });

  return card;
}

function autosizeTextarea(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

function highlightCard(id) {
  for (const card of findingsListEl.querySelectorAll(".finding-card")) {
    card.classList.toggle("is-focused", card.dataset.findingId === id);
  }
}

// Clicking a highlighted span in the editor opens the panel (if closed)
// and jumps the sidebar to that finding, mirroring the reverse direction.
document.getElementById("editor").addEventListener("click", (e) => {
  const mark = e.target.closest("mark.review-flag");
  if (!mark) return;
  const id = mark.dataset.reviewId;
  if (!id) return;
  if (reviewPanel.hidden) {
    reviewPanel.hidden = false;
    reviewBtn.classList.add("is-active");
    renderFindings();
  }
  highlightCard(id);
  document.querySelector(`.finding-card[data-finding-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" });
});

// Step through open findings in document order with Alt+Down / Alt+Up.
function stepFinding(direction) {
  const findings = listFindings(editor);
  if (findings.length === 0) return;
  const { from } = editor.state.selection;
  let idx = findings.findIndex((f) => f.from >= from);
  if (idx === -1) idx = direction > 0 ? 0 : findings.length - 1;
  else if (direction > 0 && findings[idx].from === from) idx = (idx + 1) % findings.length;
  else if (direction < 0) idx = (idx - 1 + findings.length) % findings.length;
  const target = findings[idx];
  focusFinding(editor, target.id);
  if (!reviewPanel.hidden) {
    highlightCard(target.id);
    document.querySelector(`.finding-card[data-finding-id="${CSS.escape(target.id)}"]`)?.scrollIntoView({ block: "nearest" });
  }
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
    if (!reviewPanel.hidden) {
      reviewPanel.hidden = true;
      reviewBtn.classList.remove("is-active");
    }
    return;
  }
  if (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
    e.preventDefault();
    stepFinding(e.key === "ArrowDown" ? 1 : -1);
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
