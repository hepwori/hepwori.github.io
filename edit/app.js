import { createEditor, getMarkdown, setMarkdownContent, getJSON, setJSONContent, wordCount, setActiveFinding, setPendingSelectionVisible } from "./editor.js";
import { newId, loadLibraryIndex, loadDoc, saveDoc, deleteDoc, getLastOpenId, setLastOpenId, loadConfig, saveConfig, uniqueSlug, findIdBySlug } from "./storage.js";
import { PROVIDERS } from "./llm/provider.js";
import { runReviewPass, listFindings, resolveFinding, dismissAllFindings, focusFinding } from "./review.js";
import { passHueVar } from "./passColors.js";
import { generateOutline, outlineToMarkdown } from "./generative.js";
import { getCallLog, clearCallLog, onCallLogChange } from "./llm/debugLog.js";

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
const reviewStatus = document.getElementById("review-status");
const findingsListEl = document.getElementById("findings-list");
const dismissAllBtn = document.getElementById("dismiss-all-btn");
// Which finding is "active" (card + in-editor highlight both get the
// darker treatment). Persisted here rather than only toggled imperatively
// on the current DOM, because renderFindings() rebuilds the entire card
// list (innerHTML = "") on every doc-affecting selection change — an
// imperative toggle applied just before or after that rebuild raced with
// it and silently lost, depending on timing (confirmed via Playwright).
// buildFindingCard() reads this to set the class correctly at creation
// time instead, so it's right regardless of render order.
let activeFindingId = null;
// Unanchored (document-level) findings for the current doc — not backed by
// any ProseMirror mark, so tracked here and persisted alongside the doc
// itself (see storage.js's docFindings field). renderFindings() reads this
// directly, which is reachable via syncUI() during editor construction, so
// it has to live in this pre-editor TDZ-safe block too (see the note above).
let docFindings = [];
// What the current review-status text describes, so syncUI can tell when
// it's gone stale (see checkStatusStaleness). null means either nothing
// is showing, or what's showing doesn't need staleness tracking (a
// transient busy message, always immediately replaced).
let lastStatusContext = null;

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
  // Keeps a real selection visibly highlighted (via a Decoration) even
  // after focus leaves the editor — e.g. clicking into "ask something
  // specific" — since the browser otherwise only paints selected text
  // while the contenteditable itself has focus. See editor.js's
  // pendingSelectionKey plugin.
  onFocus: (ed) => setPendingSelectionVisible(ed, false),
  onBlur: (ed) => setPendingSelectionVisible(ed, true),
});

bootDoc();

function syncUI() {
  updateWordCount();
  updateToolbarState();
  checkStatusStaleness();
  updateReviewScopeNote();
  // The panel is permanently visible, so this always keeps the sidebar
  // honest whenever findings change for any reason — accept/dismiss, a
  // fresh pass, or a mark silently auto-clearing because its text got
  // edited (see editor.js's reviewFlagAutoDismiss plugin).
  renderFindings();
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
  docFindings = [];
  titleInput.value = title;
  setMarkdownContent(editor, markdown, { emitUpdate: false });
  setLastOpenId(currentDocId);
  persistNow();
  syncUI();
}

function loadIntoEditor(record) {
  currentDocId = record.id;
  currentCreatedAt = record.createdAt;
  // Backfills a slug for docs saved before this feature existed.
  currentSlug = record.slug || uniqueSlug(record.title || "Untitled", record.id);
  docFindings = record.docFindings || [];
  titleInput.value = record.title || "Untitled";
  setJSONContent(editor, record.content, { emitUpdate: false });
  setLastOpenId(currentDocId);
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
    docFindings,
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
      styleGuide: config.styleGuide,
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
reviewPanel.dataset.activeCardStyle = config.experimental.activeCardStyle;

// ---- theme (light/dark) ----
//
// No override stored (the common case) means "follow the OS/browser
// setting" — handled entirely by style.css's prefers-color-scheme media
// query, no JS involved. The toggle button sets an explicit override,
// persisted to its own small key (edit.theme.v1, same pattern as
// edit.reviewPanelWidth.v1/edit.lastOpen.v1 — a standalone key rather than
// folded into edit.config.v1, since it's read before the editor/config
// even exist, by index.html's inline anti-flash script). This lives
// outside the pre-editor TDZ-safe block on purpose — nothing it touches is
// reachable from syncUI().

const THEME_KEY = "edit.theme.v1";
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const darkMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

function effectiveTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return darkMediaQuery.matches ? "dark" : "light";
}

function updateThemeToggleUI() {
  const isDark = effectiveTheme() === "dark";
  themeToggleBtn.textContent = isDark ? "☀️" : "🌙";
  themeToggleBtn.title = isDark ? "Switch to light mode" : "Switch to dark mode";
}

themeToggleBtn.addEventListener("click", () => {
  const next = effectiveTheme() === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  document.documentElement.dataset.theme = next;
  updateThemeToggleUI();
});

// No explicit override yet: keep following the OS/browser setting live
// (e.g. an OS that switches to dark at sunset) rather than freezing the
// toggle's icon at whatever it was when the page loaded.
darkMediaQuery.addEventListener("change", () => {
  if (!localStorage.getItem(THEME_KEY)) updateThemeToggleUI();
});

updateThemeToggleUI();

// ---- debug panel ----

const debugModal = document.getElementById("debug-modal");
const debugLogList = document.getElementById("debug-log-list");

document.getElementById("debug-btn").addEventListener("click", () => {
  debugModal.hidden = false;
  renderDebugLog();
});
document.getElementById("debug-close-btn").addEventListener("click", () => {
  debugModal.hidden = true;
});
debugModal.addEventListener("click", (e) => {
  if (e.target === debugModal) debugModal.hidden = true;
});
document.getElementById("debug-clear-btn").addEventListener("click", () => {
  clearCallLog();
});
// Keeps the panel live while it's open (e.g. running a pass with Debug
// already up) — the gate means the log's own listener never does
// pointless work while the panel is closed.
onCallLogChange(() => {
  if (!debugModal.hidden) renderDebugLog();
});

function renderDebugLog() {
  const entries = getCallLog();
  debugLogList.innerHTML = "";
  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "debug-log-empty";
    empty.textContent = "No LLM calls yet this session.";
    debugLogList.appendChild(empty);
    return;
  }
  entries.forEach((entry, i) => debugLogList.appendChild(buildDebugEntry(entry, i === 0)));
}

// Every value here (request/response bodies) came back from the LLM
// provider — untrusted, per CLAUDE.md's "LLM output is untrusted" note.
// textContent/createElement throughout, same as findings rendering,
// never innerHTML with any of it.
function buildDebugEntry(entry, openByDefault) {
  const details = document.createElement("details");
  details.className = "debug-entry";
  details.open = openByDefault;

  const summary = document.createElement("summary");
  const badge = document.createElement("span");
  badge.className = "debug-entry-badge";
  badge.textContent = `${entry.provider} · ${entry.kind}`;
  const status = document.createElement("span");
  status.className = "debug-entry-status" + (entry.ok ? " is-ok" : "");
  status.textContent = entry.error ? "network error" : String(entry.status);
  const meta = document.createElement("span");
  meta.className = "debug-entry-meta";
  meta.textContent = `${entry.durationMs}ms · ${new Date(entry.at).toLocaleTimeString()}`;
  summary.append(badge, status, meta);
  details.appendChild(summary);

  const body = document.createElement("div");
  body.className = "debug-entry-body";
  const reqHeading = document.createElement("h4");
  reqHeading.textContent = "Request";
  body.append(reqHeading, buildDebugPre(entry.requestBody));
  const resHeading = document.createElement("h4");
  resHeading.textContent = entry.error ? "Error" : "Response";
  body.append(resHeading, buildDebugPre(entry.error || entry.responseBody));
  details.appendChild(body);

  return details;
}

function buildDebugPre(value) {
  const pre = document.createElement("pre");
  pre.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return pre;
}

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
  styleGuideTextarea.value = config.styleGuide || "";
  activeCardStyleSelect.value = config.experimental.activeCardStyle;
  renderPassesEditor();
}

// ---- writing style ----

const styleGuideTextarea = document.getElementById("style-guide-textarea");
styleGuideTextarea.addEventListener("input", () => {
  config.styleGuide = styleGuideTextarea.value;
  saveConfig(config);
});

// ---- experimental settings ----

const activeCardStyleSelect = document.getElementById("active-card-style-select");
activeCardStyleSelect.addEventListener("change", () => {
  config.experimental.activeCardStyle = activeCardStyleSelect.value;
  reviewPanel.dataset.activeCardStyle = activeCardStyleSelect.value;
  saveConfig(config);
});

// ---- review pass presets ----

const passesListEl = document.getElementById("passes-list");

document.getElementById("add-pass-btn").addEventListener("click", () => {
  config.passes = [...(config.passes || []), { id: newId(), label: "", instruction: "" }];
  saveConfig(config);
  renderPassesEditor();
  renderPassChips();
});

function renderPassesEditor() {
  passesListEl.innerHTML = "";
  for (const pass of config.passes || []) {
    passesListEl.appendChild(buildPassEditorRow(pass));
  }
}

function buildPassEditorRow(pass) {
  const row = document.createElement("div");
  row.className = "pass-editor-row";

  const labelInput = document.createElement("input");
  labelInput.className = "pass-label-input";
  labelInput.type = "text";
  labelInput.placeholder = "Preset name";
  labelInput.value = pass.label || "";

  const instructionInput = document.createElement("textarea");
  instructionInput.className = "pass-instruction-input";
  instructionInput.placeholder = "What should this pass look for?";
  instructionInput.value = pass.instruction || "";
  instructionInput.spellcheck = false;

  const persistRow = () => {
    pass.label = labelInput.value;
    pass.instruction = instructionInput.value;
    saveConfig(config);
    renderPassChips();
  };
  labelInput.addEventListener("input", persistRow);
  instructionInput.addEventListener("input", persistRow);

  const actions = document.createElement("div");
  actions.className = "pass-editor-row-actions";
  const removeBtn = document.createElement("button");
  removeBtn.className = "ghost small";
  removeBtn.type = "button";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", () => {
    config.passes = (config.passes || []).filter((p) => p.id !== pass.id);
    saveConfig(config);
    renderPassesEditor();
    renderPassChips();
  });
  actions.appendChild(removeBtn);

  row.append(labelInput, instructionInput, actions);
  return row;
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
  const keyToggleBtn = section.querySelector(".key-toggle-btn");
  const modelInput = section.querySelector(".model-input");
  const testBtn = section.querySelector(".test-btn");
  const status = section.querySelector(".test-status");

  const persist = () => {
    config[id] = { apiKey: keyInput.value, model: modelInput.value };
    saveConfig(config);
  };
  keyInput.addEventListener("input", persist);
  modelInput.addEventListener("input", persist);

  keyToggleBtn.addEventListener("click", () => {
    const masked = keyInput.classList.toggle("is-masked");
    keyToggleBtn.textContent = masked ? "Show" : "Hide";
  });

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

dismissAllBtn.addEventListener("click", () => {
  const n = dismissAllFindings(editor) + docFindings.length;
  if (docFindings.length > 0) docFindings = [];
  if (n > 0) {
    persistNow();
    renderFindings();
    setReviewStatus(`Dismissed ${n}.`, false, false, { hadFindings: false, selectionKey: reviewSelectionKey() });
  }
});

// Rebuilt (not just built once) since passes are now user-editable from
// Settings — called at boot and again whenever the passes list changes.
function renderPassChips() {
  passChipsEl.innerHTML = "";
  for (const pass of config.passes || []) {
    const chip = document.createElement("button");
    chip.className = "pass-chip";
    chip.type = "button";
    chip.textContent = pass.label || "(untitled)";
    const hasInstruction = Boolean(pass.instruction?.trim());
    chip.disabled = !hasInstruction;
    if (!hasInstruction) chip.title = "This preset has no prompt yet — edit it in Settings.";
    chip.addEventListener("click", () => runPass({ passId: pass.id, passLabel: pass.label || "(untitled)", instruction: pass.instruction, triggerEl: chip }));
    passChipsEl.appendChild(chip);
  }
}
renderPassChips();

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
      styleGuide: config.styleGuide,
    });
    // runReviewPass already dispatched its own transaction above, which
    // synchronously re-ran syncUI -> renderFindings by the time we get here
    // — but only when it applied at least one anchored mark. A batch that's
    // entirely unanchored findings never touches the doc, so nothing else
    // would trigger a re-render; do it explicitly below.
    if (result.unanchored.length > 0) docFindings.push(...result.unanchored);
    persistNow();
    if (result.unanchored.length > 0) renderFindings();
    const scopeNote = result.scoped ? " (scoped to your selection)" : "";
    // What this status describes, so it can be told apart from stale later
    // (see checkStatusStaleness): the exact batch it created, if any, plus
    // the selection it ran against — either going empty is enough reason
    // for the message to stop being relevant.
    const context = {
      passId: result.passId,
      batchAt: result.batchAt,
      hadFindings: result.applied > 0 || result.unanchored.length > 0,
      selectionKey: reviewSelectionKey(),
    };
    if (result.total === 0) {
      setReviewStatus(`${passLabel}: nothing flagged${scopeNote} — looks clean.`, false, false, context);
    } else {
      const bits = [];
      if (result.applied > 0) bits.push(`${result.applied} in the text`);
      if (result.unanchored.length > 0) bits.push(`${result.unanchored.length} general`);
      const skippedNote = result.skipped > 0 ? ` — ${result.skipped} couldn't be matched back to exact text and were skipped.` : "";
      setReviewStatus(`${passLabel}: found ${bits.join(", ")}${scopeNote}.${skippedNote}`, false, false, context);
    }
    return true;
  } catch (err) {
    setReviewStatus(`${passLabel}: ${err.message || "review pass failed"}`, true, false, { hadFindings: false, selectionKey: reviewSelectionKey() });
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

// context: what the message describes, for checkStatusStaleness to judge
// later — omitted (or passed as null) for messages that don't need
// tracking (the transient busy message, always immediately replaced by
// the real result regardless).
function setReviewStatus(text, isError, isBusy, context) {
  reviewStatus.textContent = text;
  reviewStatus.hidden = !text;
  reviewStatus.classList.toggle("is-error", Boolean(isError));
  reviewStatus.classList.toggle("is-busy", Boolean(isBusy));
  lastStatusContext = text && !isBusy ? context || null : null;
}

function reviewSelectionKey() {
  const { empty, from, to } = editor.state.selection;
  return empty ? "empty" : `${from}:${to}`;
}

// The status line describes a past action, with no built-in way to know
// when its own subject stops being true — e.g. "found 1" stays put even
// after that finding gets accepted or dismissed, describing something
// that no longer exists. Runs before updateReviewScopeNote in syncUI so a
// status that goes stale immediately falls back to showing the scope
// note (if a selection is still active) in the same pass, not next tick.
function checkStatusStaleness() {
  if (!lastStatusContext) return;
  const { passId, batchAt, hadFindings, selectionKey } = lastStatusContext;
  const selectionChanged = reviewSelectionKey() !== selectionKey;
  const batchInBatch = (f) => f.passId === passId && f.createdAt === batchAt;
  const batchIsEmpty = hadFindings && !listFindings(editor).some(batchInBatch) && !docFindings.some(batchInBatch);
  if (selectionChanged || batchIsEmpty) {
    setReviewStatus("", false);
  }
}

function updateReviewScopeNote() {
  // The status line takes precedence — showing both at once is redundant
  // (the status text already says "(scoped to your selection)" when
  // relevant) and, worse, can describe two different things at a glance.
  if (!reviewStatus.hidden) {
    reviewScopeNote.hidden = true;
    return;
  }
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
  // Anchored (mark-based) and unanchored (document-level, in docFindings)
  // findings are unified here into one list for grouping/sorting/rendering
  // — the split only matters again inside buildFindingCard, which reduces
  // the affordances (no highlight, no suggestion, dismiss-only) for the
  // unanchored kind.
  const findings = [
    ...listFindings(editor).map((f) => ({ ...f, anchored: true })),
    ...docFindings.map((f) => ({ ...f, anchored: false })),
  ];
  dismissAllBtn.hidden = findings.length === 0;
  findingsListEl.innerHTML = "";
  if (findings.length === 0) {
    const empty = document.createElement("div");
    empty.className = "findings-empty";
    empty.textContent = "Nothing flagged yet. Pick a pass above, or ask something specific about your selection.";
    findingsListEl.appendChild(empty);
    return;
  }

  const groups = new Map();
  for (const f of findings) {
    if (!groups.has(f.passId)) groups.set(f.passId, { label: f.passLabel, items: [] });
    groups.get(f.passId).items.push(f);
  }

  // Newest batch on top: each group's rank is its most recent finding's
  // createdAt (a run's findings all share one timestamp, set once per
  // call in runReviewPass), so re-running a named pass bumps its whole
  // group back to the top. Findings from before this field existed have
  // no createdAt — they sort as oldest, which is the sensible fallback.
  const timeOf = (f) => (f.createdAt ? Date.parse(f.createdAt) : 0) || 0;
  const orderedGroups = [...groups.entries()].sort(
    (a, b) => Math.max(...b[1].items.map(timeOf)) - Math.max(...a[1].items.map(timeOf))
  );

  for (const [passId, { label, items }] of orderedGroups) {
    const group = document.createElement("div");
    group.className = "findings-group";

    const header = document.createElement("div");
    header.className = "findings-group-header";
    const dot = document.createElement("span");
    dot.className = "pass-color-dot";
    dot.style.setProperty("--pass-hue", passHueVar(passId, label));
    header.append(dot, document.createTextNode(label));
    const count = document.createElement("span");
    count.className = "findings-group-count";
    count.textContent = `· ${items.length} open`;
    header.appendChild(count);
    group.appendChild(header);

    // Unanchored findings sort first within the group — general/overview
    // context ahead of the position-specific ones — newest first among
    // themselves. Anchored findings follow, newest-first, with ties (same
    // batch) falling back to document order, the sensible reading order
    // for one run.
    const orderedItems = [...items].sort((a, b) => {
      if (a.anchored !== b.anchored) return a.anchored ? 1 : -1;
      if (a.anchored) return timeOf(b) - timeOf(a) || a.from - b.from;
      return timeOf(b) - timeOf(a);
    });
    for (const finding of orderedItems) {
      group.appendChild(buildFindingCard(finding));
    }
    findingsListEl.appendChild(group);
  }
}

function buildFindingCard(finding) {
  const card = document.createElement("div");
  card.className = "finding-card";
  card.classList.toggle("is-focused", finding.id === activeFindingId);
  card.dataset.findingId = finding.id;
  card.tabIndex = 0; // focusable, so Up/Down can walk the list (see the review-panel keydown handler)
  // --pass-hue inherits down to .finding-category below for free — no
  // need to set it again there.
  card.style.setProperty("--pass-hue", passHueVar(finding.passId, finding.passLabel));

  if (finding.category) {
    const cat = document.createElement("div");
    cat.className = "finding-category";
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
    // Focus alone should activate the card too — via Tab, not just a
    // click (click's stopPropagation above only stops the *card's* click
    // handler from double-firing; it doesn't cover keyboard focus at all).
    sugInput.addEventListener("focus", () => {
      if (activeFindingId === finding.id) return; // already active, avoid redundant work
      focusFinding(editor, finding.id, { focusEditor: false });
      highlightCard(finding.id);
      // Same rebuild-races-focus issue as the card click handler below:
      // the selection change above triggers a synchronous renderFindings()
      // rebuild (innerHTML = ""), which destroys the very textarea that's
      // mid-focus — re-focus the freshly rebuilt one so the user isn't
      // silently kicked out of it. Its own focus listener fires again,
      // but activeFindingId is already correct by then, so the guard
      // above short-circuits it.
      document
        .querySelector(`.finding-card[data-finding-id="${CSS.escape(finding.id)}"] .finding-suggestion`)
        ?.focus({ preventScroll: true });
    });
    card.appendChild(sugInput);
    requestAnimationFrame(() => autosizeTextarea(sugInput));
  }

  const actions = document.createElement("div");
  actions.className = "finding-actions";

  // Without a suggestion, "Accept" has nothing to apply — resolveFinding's
  // applySuggestion:true path requires *both* the flag and actual text
  // (`if (applySuggestion && text)`), so it silently falls through to the
  // exact same removeMark-only branch Dismiss already takes. Two buttons
  // with identical behavior just asks the author to pick a label for the
  // same action — show one.
  if (finding.suggestion) {
    const acceptBtn = document.createElement("button");
    acceptBtn.className = "primary small";
    acceptBtn.textContent = "Accept";
    acceptBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      // resolveFinding dispatches its own transaction, which re-triggers
      // syncUI -> renderFindings synchronously before this call returns.
      resolveFinding(editor, finding.id, { applySuggestion: true, suggestionText: sugInput?.value });
      persistNow();
    });
    actions.appendChild(acceptBtn);
  }

  const dismissBtn = document.createElement("button");
  dismissBtn.className = finding.suggestion ? "small" : "primary small";
  dismissBtn.textContent = "Dismiss";
  dismissBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (finding.anchored) {
      resolveFinding(editor, finding.id);
      persistNow();
    } else {
      dismissDocFinding(finding.id);
    }
  });
  actions.appendChild(dismissBtn);

  card.appendChild(actions);

  card.addEventListener("click", () => {
    // focusEditor: false — see the comment on focusFinding() in review.js.
    // Keeping DOM focus on the card (rather than the editor) is what lets
    // up/down arrow keep walking the card list right after a click.
    // Unanchored findings have no mark/position to jump to — nothing to
    // focus in the editor at all.
    if (finding.anchored) focusFinding(editor, finding.id, { focusEditor: false });
    highlightCard(finding.id);
    // The selection change above fires onSelectionUpdate -> syncUI() ->
    // renderFindings(), rebuilding the whole card list (innerHTML = "")
    // synchronously before we get here. The `card` this closure captured
    // is now a detached node — focusing it would be a no-op — so
    // re-look-up the freshly rendered card by id.
    document
      .querySelector(`.finding-card[data-finding-id="${CSS.escape(finding.id)}"]`)
      ?.focus({ preventScroll: true });
  });

  return card;
}

// Unanchored findings have no mark, so nothing here dispatches a
// ProseMirror transaction to trigger the usual syncUI -> renderFindings
// chain — persist and re-render explicitly, mirroring what resolveFinding
// gets for free.
function dismissDocFinding(id) {
  const idx = docFindings.findIndex((f) => f.id === id);
  if (idx === -1) return false;
  docFindings.splice(idx, 1);
  persistNow();
  renderFindings();
  return true;
}

function autosizeTextarea(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

// Keeps the sidebar card *and* its in-editor highlight in visual sync —
// deliberately one function, not two independently-called ones, after a
// card-click/mark-click/Alt+Up-Down bug where only the card ever got the
// active treatment: the in-text highlight looked identical to every other
// open finding, giving no visual cue which passage a selected card
// referred to. A single call site for both can't drift out of sync again.
function highlightCard(id) {
  activeFindingId = id;
  // Also toggle the current DOM directly (cheap, and correct for the
  // common case where no rebuild races it) — buildFindingCard's read of
  // activeFindingId is the fallback that makes this correct even when a
  // renderFindings() rebuild happens right before or after this runs.
  for (const card of findingsListEl.querySelectorAll(".finding-card")) {
    card.classList.toggle("is-focused", card.dataset.findingId === id);
  }
  // The mark's own highlight is a ProseMirror Decoration (editor.js),
  // not DOM manipulation here — see setActiveFinding's comment for why.
  setActiveFinding(editor, id);
}

// Clicking a highlighted span in the editor jumps the (always-visible)
// sidebar to that finding, mirroring the reverse direction.
document.getElementById("editor").addEventListener("click", (e) => {
  const mark = e.target.closest("mark.review-flag");
  if (!mark) return;
  const id = mark.dataset.reviewId;
  if (!id) return;
  highlightCard(id);
  document.querySelector(`.finding-card[data-finding-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" });
});

// Step through open findings in document order with Alt+Down / Alt+Up —
// works from anywhere (typically while writing, cursor in the editor).
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
  highlightCard(target.id);
  document.querySelector(`.finding-card[data-finding-id="${CSS.escape(target.id)}"]`)?.scrollIntoView({ block: "nearest" });
}

// Plain Up/Down walks card-to-card — but only when a card itself has
// focus (clicked, or reached via this same navigation), so it never
// hijacks arrow keys in the custom-instruction input, a chip button, or
// anywhere else within the panel where they have their normal meaning.
// Deliberately does NOT call focusFinding here: that moves real DOM focus
// into the editor (it's `editor.chain().focus()...`), which would steal
// focus off the card list after a single step. Instead it just previews
// — scrolls the flagged text into view, while highlightCard (below)
// covers marking both the card and the mark as active — while focus (and
// continued arrow-key navigation) stays on the cards.
reviewPanel.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const activeCard = document.activeElement?.closest(".finding-card");
  if (!activeCard) return;
  e.preventDefault();
  const cards = [...findingsListEl.querySelectorAll(".finding-card")];
  const idx = cards.indexOf(activeCard);
  const nextIdx = e.key === "ArrowDown" ? Math.min(idx + 1, cards.length - 1) : Math.max(idx - 1, 0);
  const nextCard = cards[nextIdx];
  if (nextCard === activeCard) return;
  nextCard.focus({ preventScroll: true });
  nextCard.scrollIntoView({ block: "nearest" });
  const id = nextCard.dataset.findingId;
  highlightCard(id);
  scrollMarkIntoView(id);
});

// The click/step paths that call focusFinding() already scroll the mark
// into view themselves (see review.js) — this is only for arrow-key
// card-nav, which deliberately doesn't call focusFinding (see above) and
// so needs its own scroll.
function scrollMarkIntoView(id) {
  document.querySelector(`mark.review-flag[data-review-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center" });
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
    const openModals = document.querySelectorAll(".modal:not([hidden])");
    if (openModals.length > 0) {
      for (const modal of openModals) modal.hidden = true;
      return;
    }
    // Otherwise, if focus is anywhere in the review panel (the
    // custom-instruction input via Cmd/Ctrl+/, a pass chip, a finding
    // card reached via arrow-nav, ...), pop back to the editor. ProseMirror
    // keeps its selection alive across a DOM blur on its own, so a plain
    // focus() lands you back exactly where you were writing — no need to
    // snapshot/restore a position by hand.
    if (reviewPanel.contains(document.activeElement)) {
      e.preventDefault();
      editor.commands.focus();
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
  if (e.key === "/") {
    // Global "summon a review" shortcut — works from anywhere, including
    // while the editor has focus, so asking about something is always a
    // couple of keystrokes away. Plain Enter (or Cmd/Ctrl+Enter, since
    // e.key is "Enter" either way) already runs it — see the
    // custom-instruction-input keydown handler below.
    e.preventDefault();
    customInstructionInput.focus();
    customInstructionInput.select();
  } else if (e.key.toLowerCase() === "k") {
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
