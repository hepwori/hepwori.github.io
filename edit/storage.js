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

// Seed set for `passes` — shown as chips in the Review panel, each one
// fully editable (label + instruction) from Settings, plus add/remove.
// This is only the *default* a fresh config starts with; a saved config's
// own `passes` array (even a heavily edited one) always wins wholesale —
// see loadConfig's merge below.
function defaultPasses() {
  return [
    { id: "grammar", label: "Grammar", instruction: "Find grammar, spelling, and punctuation errors. Flag each one with a brief note and, where the fix is unambiguous, a corrected replacement." },
    { id: "flow", label: "Flow", instruction: "Look for sentences or transitions that are awkward, hard to follow, or disrupt the piece's rhythm. Explain what's off and, where you can, suggest a smoother replacement." },
    { id: "filler", label: "Filler words", instruction: `Find filler words, hedges, and throat-clearing phrases (e.g. "in order to", "it's worth noting that", "I think that") that could be cut or tightened without losing meaning.` },
    { id: "passive", label: "Passive voice", instruction: "Find sentences that are genuinely in passive voice (the subject receives the action, e.g. \"the ball was thrown by him\" not \"he threw the ball\") AND where switching to active would clearly read better. Suggest the active rewrite. Do not flag sentences that are already active voice." },
    { id: "structure", label: "Structure", instruction: "Look at the piece's overall structure and organization — ordering, section balance, whether ideas build logically. Flag structural issues. A finding about the piece as a whole doesn't need a quote — say so directly rather than forcing an anchor onto one span." },
  ];
}

function defaultConfig() {
  return {
    activeProvider: "gemini",
    gemini: { apiKey: "", model: "gemini-2.5-flash" },
    claude: { apiKey: "", model: "claude-sonnet-5" },
    // Free-text context given to the LLM for every review pass and the
    // generative outline mode alike — "write like X", a house style, tone
    // notes, whatever. Empty means no style context is injected.
    styleGuide: "",
    passes: defaultPasses(),
    // Scratch space for trying out UI treatments live against real content,
    // instead of guessing from screenshots — see the Settings modal's
    // "Experimental" section. Not meant to accumulate forever: once a
    // choice sticks, fold it into the real default and drop the toggle.
    experimental: { activeCardStyle: "tint" },
  };
}

export function loadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return defaultConfig();
    // Merge over defaults so a config saved before a new field existed
    // (or before a provider was added) still comes back complete. `passes`
    // and `styleGuide` are plain top-level fields, so the spread already
    // does the right thing for them: the stored value (even an edited-down
    // passes array) wins wholesale when present, the default seed applies
    // only when the field is missing entirely (an older saved config).
    const stored = JSON.parse(raw);
    const base = defaultConfig();
    return {
      ...base,
      ...stored,
      gemini: { ...base.gemini, ...stored.gemini },
      claude: { ...base.claude, ...stored.claude },
      experimental: { ...base.experimental, ...stored.experimental },
    };
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}
