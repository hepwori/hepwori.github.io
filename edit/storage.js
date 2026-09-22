// Local doc library, in localStorage. No sync, no accounts — an accepted
// compromise (see plan). Storage format is the ProseMirror JSON doc, not
// markdown: that's what preserves review-flag marks (phase 5) across
// reloads. Markdown is always a derived export view.
//
// Keys:
//   edit.library.v1        -> { docs: [{id, title, slug, updatedAt}] }   (index, for listing)
//   edit.doc.<id>           -> { id, title, slug, content, createdAt, updatedAt, docFindings }  (body)
//     docFindings is unanchored (document-level) findings — see review.js's
//     `unanchored` results. Optional/defaults to [] for docs saved before
//     this field existed; no migration needed.
//   edit.lastOpen.v1        -> doc id, so reloading the page resumes where you left off
//   edit.config.v1          -> LLM connection settings, style guide, passes (see "LLM connection settings" below)
//   edit.theme.v1            -> "light"/"dark" override (app.js owns this one directly — see style.css's dark mode)
//   edit.reviewPanelWidth.v1 -> dragged review-panel width in px (app.js owns this one directly)
//
// Every key this app uses starts with "edit." — a deliberate convention,
// not just a namespacing habit: hepwori.github.io hosts several unrelated
// projects on the same origin (shared localStorage), and resetEverything()
// below sweeps by this prefix rather than a hardcoded key list.
//
// slug locks in once a doc gets a real (non-"Untitled") title — see
// app.js's persistNow — so a link to a doc (edit/#/<slug>) keeps working
// even after later renames.

const LIBRARY_KEY = "edit.library.v1";
const LAST_OPEN_KEY = "edit.lastOpen.v1";
const DOC_KEY_PREFIX = "edit.doc.";

export function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function loadLibraryIndex() {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    return raw ? JSON.parse(raw) : { docs: [] };
  } catch {
    return { docs: [] };
  }
}

function saveLibraryIndex(index) {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(index));
}

export function loadDoc(id) {
  try {
    const raw = localStorage.getItem(DOC_KEY_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDoc({ id, title, slug, content, createdAt, docFindings }) {
  const now = new Date().toISOString();
  const existing = loadDoc(id);
  const record = {
    id,
    title: title || "Untitled",
    slug: slug || existing?.slug || null,
    content,
    createdAt: existing?.createdAt || createdAt || now,
    updatedAt: now,
    docFindings: docFindings || [],
  };
  localStorage.setItem(DOC_KEY_PREFIX + id, JSON.stringify(record));

  const index = loadLibraryIndex();
  const entry = { id, title: record.title, slug: record.slug, updatedAt: record.updatedAt };
  const i = index.docs.findIndex((d) => d.id === id);
  if (i === -1) index.docs.push(entry);
  else index.docs[i] = entry;
  saveLibraryIndex(index);

  return record;
}

export function deleteDoc(id) {
  localStorage.removeItem(DOC_KEY_PREFIX + id);
  const index = loadLibraryIndex();
  index.docs = index.docs.filter((d) => d.id !== id);
  saveLibraryIndex(index);
}

// ---- slugs ----

export function slugify(title) {
  const base = (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "untitled";
}

// Appends -2, -3, ... until the slug doesn't collide with another doc's.
export function uniqueSlug(title, excludeId) {
  const base = slugify(title);
  const taken = new Set(
    loadLibraryIndex().docs.filter((d) => d.id !== excludeId && d.slug).map((d) => d.slug)
  );
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function findIdBySlug(slug) {
  const entry = loadLibraryIndex().docs.find((d) => d.slug === slug);
  return entry ? entry.id : null;
}

export function getLastOpenId() {
  return localStorage.getItem(LAST_OPEN_KEY);
}

export function setLastOpenId(id) {
  localStorage.setItem(LAST_OPEN_KEY, id);
}

// ---- LLM connection settings ----
//
// Plain-text in localStorage — an accepted compromise for a single-user
// (or trusted-friend, bring-your-own-key) tool. Never sent anywhere but
// the provider's own API, straight from the browser.

const CONFIG_KEY = "edit.config.v1";

// The style guide + passes half of the defaults lives in its own checked-in
// JSON file, not hardcoded here — the point is that it's a plain, readable,
// directly-editable artifact Isaac can iterate on with Claude: tweak the
// live settings in-app, export the current ones (Debug panel), hand the
// JSON to Claude, it becomes the new edit/defaults.json, fresh installs
// pick it up. Fetched with a plain `fetch` (not a JSON module import —
// `import ... with {type:"json"}` would be synchronous and avoid the
// async-boot wrinkle below, but it's a parse-time failure on any browser
// that doesn't support it, e.g. Safari as of this writing; `fetch` already
// works everywhere, so it's the one that doesn't need reworking if this
// ever needs to run somewhere other than Isaac's own Chrome).
const DEFAULTS_URL = new URL("./defaults.json", import.meta.url);

async function fetchPromptDefaults() {
  try {
    const res = await fetch(DEFAULTS_URL);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    return {
      styleGuide: typeof data.styleGuide === "string" ? data.styleGuide : "",
      passes: Array.isArray(data.passes) ? data.passes : [],
    };
  } catch (err) {
    // Same-origin static file, should never actually fail in normal use —
    // but a missing/broken defaults.json shouldn't take the whole app down
    // with it. Falls back to an empty style guide and no preset chips
    // (the custom-instruction box still works) rather than throwing.
    console.warn("edit/defaults.json failed to load, falling back to empty prompt defaults:", err);
    return { styleGuide: "", passes: [] };
  }
}

async function defaultConfig() {
  const { styleGuide, passes } = await fetchPromptDefaults();
  return {
    activeProvider: "gemini",
    gemini: { apiKey: "", model: "gemini-2.5-flash" },
    claude: { apiKey: "", model: "claude-sonnet-5" },
    // Free-text context given to the LLM for every review pass and the
    // generative outline mode alike — "write like X", a house style, tone
    // notes, whatever. Empty means no style context is injected.
    styleGuide,
    passes,
    // Scratch space for trying out UI treatments live against real content,
    // instead of guessing from screenshots — see the Settings modal's
    // "Experimental" section. Not meant to accumulate forever: once a
    // choice sticks, fold it into the real default and drop the toggle.
    experimental: { activeCardStyle: "tint" },
  };
}

export async function loadConfig() {
  const base = await defaultConfig();
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return base;
    // Merge over defaults so a config saved before a new field existed
    // (or before a provider was added) still comes back complete. `passes`
    // and `styleGuide` are plain top-level fields, so the spread already
    // does the right thing for them: the stored value (even an edited-down
    // passes array) wins wholesale when present, the default seed applies
    // only when the field is missing entirely (an older saved config).
    const stored = JSON.parse(raw);
    return {
      ...base,
      ...stored,
      gemini: { ...base.gemini, ...stored.gemini },
      claude: { ...base.claude, ...stored.claude },
      experimental: { ...base.experimental, ...stored.experimental },
    };
  } catch {
    return base;
  }
}

export function saveConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

// ---- reset (Debug panel) ----
//
// Both are destructive and both reload the page afterward rather than
// trying to live-rewire every bit of already-rendered UI state.

// Discards customizations, falling back to edit/defaults.json (or the
// hardcoded gemini/claude/experimental defaults) on the next load.
export function resetConfigToDefaults() {
  localStorage.removeItem(CONFIG_KEY);
}

// The "start over completely" button for onboarding work — every doc,
// every setting, every key. Sweeps by prefix rather than naming each key
// individually (LIBRARY_KEY/DOC_KEY_PREFIX/LAST_OPEN_KEY/CONFIG_KEY here,
// plus a couple more app.js owns directly — edit.theme.v1,
// edit.reviewPanelWidth.v1) so a future new key is covered automatically
// without this needing to be kept in sync. Every key this app uses starts
// with "edit." — see the module comment at the top of this file — and nothing
// outside that prefix is touched, since hepwori.github.io hosts several
// unrelated projects sharing this same origin's localStorage.
export function resetEverything() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("edit.")) localStorage.removeItem(key);
  }
}
