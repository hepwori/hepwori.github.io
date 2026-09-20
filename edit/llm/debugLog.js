// In-memory, ephemeral log of raw LLM request/response pairs, for the
// Debug panel (app.js). Deliberately not persisted to localStorage — call
// bodies carry full document content, no reason for that to outlive the
// tab. Never logs headers, so an API key (sent as x-goog-api-key/x-api-key,
// never in the body) can't end up in here even by accident.
const MAX_ENTRIES = 20;
let entries = [];
const listeners = new Set();

function notify() {
  for (const fn of listeners) fn();
}

// fn is called (no args) whenever the log changes — app.js uses this to
// keep an open Debug panel live rather than a stale snapshot from when it
// was opened. Returns an unsubscribe function.
export function onCallLogChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getCallLog() {
  return entries;
}

export function clearCallLog() {
  entries = [];
  notify();
}

function tryParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// Wraps fetch with logging of the request/response bodies, status, and
// timing — returns (or throws) exactly what a plain fetch would, so call
// sites don't need their own error handling to change. provider/kind are
// just labels for display ("Gemini"/"runPass", etc.).
export async function loggedFetch(provider, kind, url, options) {
  const startedAt = Date.now();
  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${startedAt}-${Math.random().toString(36).slice(2)}`,
    provider,
    kind,
    url,
    requestBody: typeof options?.body === "string" ? tryParseJSON(options.body) ?? options.body : null,
    at: new Date(startedAt).toISOString(),
  };
  try {
    const res = await fetch(url, options);
    const text = await res.clone().text();
    entry.status = res.status;
    entry.ok = res.ok;
    entry.responseBody = tryParseJSON(text) ?? text;
    entry.durationMs = Date.now() - startedAt;
    entries = [entry, ...entries].slice(0, MAX_ENTRIES);
    notify();
    return res;
  } catch (err) {
    entry.error = err?.message || String(err);
    entry.durationMs = Date.now() - startedAt;
    entries = [entry, ...entries].slice(0, MAX_ENTRIES);
    notify();
    throw err;
  }
}
