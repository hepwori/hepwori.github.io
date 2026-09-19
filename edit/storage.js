// Local doc library, in localStorage. No sync, no accounts — an accepted
// compromise (see plan). Storage format is the ProseMirror JSON doc, not
// markdown: that's what preserves review-flag marks (phase 5) across
// reloads. Markdown is always a derived export view.
//
// Keys:
//   edit.library.v1        -> { docs: [{id, title, updatedAt}] }   (index, for listing)
//   edit.doc.<id>           -> { id, title, content, createdAt, updatedAt }  (body)
//   edit.lastOpen.v1        -> doc id, so reloading the page resumes where you left off

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

export function saveDoc({ id, title, content, createdAt }) {
  const now = new Date().toISOString();
  const existing = loadDoc(id);
  const record = {
    id,
    title: title || "Untitled",
    content,
    createdAt: existing?.createdAt || createdAt || now,
    updatedAt: now,
  };
  localStorage.setItem(DOC_KEY_PREFIX + id, JSON.stringify(record));

  const index = loadLibraryIndex();
  const entry = { id, title: record.title, updatedAt: record.updatedAt };
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

function defaultConfig() {
  return {
    activeProvider: "gemini",
    gemini: { apiKey: "", model: "gemini-2.5-flash" },
    claude: { apiKey: "", model: "claude-sonnet-5" },
  };
}

export function loadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return defaultConfig();
    // Merge over defaults so a config saved before a new field existed
    // (or before a provider was added) still comes back complete.
    const stored = JSON.parse(raw);
    const base = defaultConfig();
    return {
      ...base,
      ...stored,
      gemini: { ...base.gemini, ...stored.gemini },
      claude: { ...base.claude, ...stored.claude },
    };
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}
