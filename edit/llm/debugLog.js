// In-memory, ephemeral log of raw LLM request/response pairs, for the
// Debug panel (app.js). Deliberately not persisted to localStorage — call
// bodies carry full document content, no reason for that to outlive the
// tab. Never logs headers, so an API key (sent as x-goog-api-key/x-api-key,
// never in the body) can't end up in here even by accident.
const MAX_ENTRIES = 20;
// Gemini in particular has been observed hanging for minutes before
// eventually 503-ing — better to fail fast and let the author retry than
// leave the spinner running indefinitely. Applied uniformly to every LLM
// call (both providers, runPass/generateOutline/testConnection alike)
// since they all funnel through loggedFetch below.
const TIMEOUT_MS = 60_000;
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
    // options.signal is never set by any call site today, so this always
    // wins — but honor a caller-supplied one instead of clobbering it, in
    // case that changes later.
    const res = await fetch(url, { ...options, signal: options?.signal || AbortSignal.timeout(TIMEOUT_MS) });
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
    // Rethrow a message worth showing in the status line — the raw
    // DOMException text ("signal timed out", browser-dependent) stays in
    // the debug log entry above, not lost, just not what surfaces in the UI.
    if (err?.name === "TimeoutError") {
      throw new Error(`${provider} didn't respond within ${TIMEOUT_MS / 1000}s — timed out.`);
    }
    throw err;
  }
}
