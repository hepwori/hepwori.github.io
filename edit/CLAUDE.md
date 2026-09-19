# CLAUDE.md

Working notes for Claude on this project.

## What this is

A browser-based, WYSIWYG markdown editor with an AI copyediting layer, for Isaac's personal writing. No server-side, no build step — matches every other project in this repo (see `bikeviz/`, `pmp/` for the same philosophy). Full design rationale lives in the plan this was built from; the short version:

- WYSIWYG editing backed by Tiptap (ProseMirror), markdown as the import/export format, ProseMirror JSON as the actual storage format (so review-flag marks and editor state survive reloads — markdown is always a derived view).
- An AI review-pass system (à la Google Docs' "Editing passes" panel): run a named prompt ("Grammar", "Filler words", etc.) against the doc, get findings highlighted inline, step through and accept/dismiss each one. The LLM edits and flags, it never writes prose in bulk.
- LLM connection is swappable — Gemini (AI Studio key, direct browser `fetch`, no proxy needed) at work, Claude (`anthropic-dangerous-direct-browser-access` header) at home. Both confirmed to support direct-from-browser CORS.
- No accounts, no sync — a local doc library in `localStorage`. Accepted compromise: different browsers/machines have separate libraries.

## Project structure

```
edit/
├── CLAUDE.md      you are here
├── index.html     shell: topbar/toolbar + editor pane + import/library modals
├── style.css
├── app.js         bootstrap: wires editor, toolbar, import/copy, library, autosave, toast
├── editor.js      Tiptap setup (StarterKit, Link, Placeholder, Markdown extension), markdown + JSON helpers
├── storage.js     doc library (localStorage): index + per-doc records, last-open tracking
├── paste.js       rich paste: turndown (HTML→md) + a ProseMirror handlePaste hook
├── llm/
│   ├── provider.js   registry: provider id -> {label, defaultModel, testConnection, runPass, ...}
│   ├── gemini.js      Gemini AI Studio REST client (testConnection + runPass), called directly from the browser
│   └── claude.js       Anthropic Messages API client (testConnection + runPass), direct-browser-access header
├── review.js      pass engine: prompt building, quote-anchoring findings as ReviewFlag marks, accept/dismiss
├── favicon.js     per-doc identicon favicon (SHA-1 of doc id -> 5x5 grid + hue), no external lib
├── favicon.svg    static fallback shown before boot finishes
```

Later phases add: `generative.js` (outline mode).

## Stack notes

- No npm, no bundler. Everything is `<script type="module">` importing straight from `esm.sh`, pinned to an exact `@tiptap/*` version (currently `3.31.3`) with `?deps=@tiptap/pm@<version>` on every import so esm.sh resolves one shared ProseMirror instance instead of duplicates — skipping that query param is a common source of "duplicate instance of prosemirror-state"-style breakage.
- `editor.js` uses the official `@tiptap/markdown` extension: `editor.getMarkdown()` to export, `editor.commands.setContent(md, { contentType: "markdown" })` to load. Confirmed working end-to-end (headings, emphasis, links, lists, blockquotes, fenced code blocks all round-trip cleanly).
- Gotcha hit once already, worth remembering: Tiptap's `onSelectionUpdate` fires **synchronously during `new Editor()` construction**. Any DOM lookups a callback touches must happen before `createEditor()` is called, or you get a "cannot access '<const>' before initialization" TDZ error that silently aborts the rest of a module's top-level code (which looks like "half the buttons don't work" with no obvious cause). See the ordering in `app.js`.
- Toolbar active-state (`.is-active`) needs refreshing on `onUpdate` as well as `onSelectionUpdate` — a mark toggle (bold, etc.) is a doc-changing transaction but doesn't necessarily change the selection range, so `onSelectionUpdate` alone leaves the toolbar stale after clicking its own buttons.
- `setContent`/`setMarkdownContent`/`setJSONContent` all take `{ emitUpdate: false }` (a real Tiptap core option, confirmed by reading `@tiptap/core`'s `setContent.ts`, and the markdown extension passes options through untouched) — use it for every *programmatic* content load (boot, switching docs in the library, `+ New`) so it doesn't kick off a redundant autosave cycle of content that's already what's on disk. Leave it default (`true`) for actual user actions like the Import modal, which should count as an edit worth saving.
- Escape-closes-modal is generic (`app.js`, matches any `.modal:not([hidden])`) — new modals (e.g. phase 4's settings modal) get this for free, no repeat wiring needed.
- Rich paste (`paste.js`) hooks ProseMirror's `handlePaste` editorProp, not a DOM `paste` listener — returning `true` from it tells ProseMirror "don't also insert your own parsed slice." It needs the live `Editor` instance to call `insertContent`, which doesn't exist yet at the point `editorProps` is passed into `new Editor(...)` — worked around with a thunk (`createPasteHandler(() => editorRef)`) that's satisfied right after construction; see `editor.js`.
- Tiptap's `insertContent`/`insertContentAt` accept the same `{ contentType: "markdown" }` option as `setContent` (all three delegate to `editor.markdown.parse()` under the hood) — that's the whole trick behind rich paste: turndown flattens HTML to markdown text, then `insertContent(md, { contentType: "markdown" })` parses and inserts it as real nodes at the cursor.
- Internal copy/paste (dragging or copying a selection within the doc itself) is deliberately left alone — ProseMirror tags its own clipboard HTML with `data-pm-slice`, and the paste handler checks for that and bails out to native handling, so an internal copy never round-trips through markdown and silently drops something markdown can't represent (a mark with no markdown syntax, e.g. phase 5's review flags).
- Both LLM providers are called with a plain `fetch` straight from the browser, no proxy — confirmed working (real CORS preflight, not just docs): Gemini's `generativelanguage.googleapis.com` sends `Access-Control-Allow-Origin: *`; Claude's Messages API needs the `anthropic-dangerous-direct-browser-access: true` header. `edit.config.v1` (in `storage.js`) holds both providers' key + model plus which one is "active"; both stay configured simultaneously (matches the actual use case — Gemini at work, Claude at home, switched via the radio, not re-entered).
- Structured LLM output: Gemini via `generationConfig.responseMimeType: "application/json"` + `responseSchema`; Claude via forced tool-use (`tool_choice: {type:"tool", name:...}`) so the model has to call the tool rather than maybe replying in prose. Both return the same shape either way: `{ findings: [{ quote, note, suggestion?, category? }] }`.
- **Scope (whole doc vs. a passage) is implicit, not a UI toggle**: `runReviewPass` (`review.js`) checks `editor.state.selection` itself — a non-empty selection at the moment you hit Run scopes the prompt to it (full doc still goes along as context). This covers both "run a named pass over everything" and "select a passage, ask something specific about just it" through one code path; no separate scoping control needed. An ad-hoc instruction typed into the custom box is handled identically to a named pass — it's just a prompt that came from a text input instead of `PASS_LIBRARY`, with `passId` generated from a timestamp and `passLabel` the truncated instruction text.
- **Finding anchoring**: the model is told a `quote` must be copied verbatim from the doc; `review.js`'s `findQuoteRange` flattens the doc to one string (`buildTextIndex`, tracking a per-character map back to real ProseMirror positions) and searches with a regex built from the quote where runs of whitespace become `\s+` — handles both an exact match and the case where the model reflows a line-wrapped quote's whitespace, in one path. A quote that still doesn't match is silently dropped and counted as "skipped" in the status line; nothing partial or guessed gets applied.
- **Gotcha, cost real debugging time**: `Transaction.insertText(text, from, to)` (used when accepting a finding with a suggestion) deliberately carries over `$from.marksAcross($to)` — the marks active across the *replaced* range — onto the new text. That's desired for bold/italic surviving an accepted edit, but it also means the reviewFlag mark itself gets reapplied to the replacement, so accepting looked like it did nothing (mark never went away). Fix: `resolveFinding` inserts the suggestion, then explicitly `removeMark`s just `reviewFlag` (not everything) off the newly-inserted range.
- **No separate "accepted" bookkeeping** — a finding's mark presence in the doc *is* its "open" state; accept/dismiss both end by removing the mark (accept via the insertText-then-strip-mark path above, dismiss via a plain `removeMark`), so resolved findings just disappear from both the text and the sidebar rather than sticking around in a resolved state. Per-pass "N open" counts in the sidebar are computed live from `listFindings(editor)` grouped by `passId` — no counters to keep in sync. Re-running the same named pass adds a second, independent batch rather than replacing the first (acceptable for v1; the screenshot's "run 1/30" history stepper is a nice-to-have, not built).
- Same TDZ trap as phase 1, different variable: `updateReviewScopeNote()` (called from `syncUI`, which fires synchronously during `createEditor()`) touches `reviewPanel`/`reviewScopeNote` — those two lookups had to move up into the same pre-editor block as `toolbar`, everything else in the review section's wiring can stay where it naturally reads. Rule of thumb reaffirmed: anything `syncUI` (or anything it calls) touches must be declared before `createEditor()` is called, full stop.
- The review panel is a persistent `<aside>` toggled via `hidden`, not a `.modal` — but Escape closes it too (handled explicitly in the same keydown handler, not by the generic `.modal` sweep) for consistency with everything else that's dismissible.
- Pass library (`PASS_LIBRARY` in `review.js`) is seeded with five fixed passes and not yet editable from the UI — full "configurable prompt library" CRUD was descoped in favor of the ad-hoc custom-instruction box, which covers the actually-requested use case (one-off, specific asks) more directly than a saved-preset-management UI would have. Worth revisiting if Isaac wants to save a recurring custom instruction as a new chip.
- **Favicons**: `favicon.js` reimplements the same well-known 5x5 symmetric-grid identicon algorithm as Isaac's own `hepwori/favidenticon` Chrome extension (itself built on `identicon.js` by Stewart Lord) natively — `crypto.subtle.digest("SHA-1", ...)` for the hash (no need to vendor a JS SHA-1 implementation), SVG for the image (no need for the original's manual PNG byte-encoding), set as a `data:image/svg+xml;base64,...` href on the one `<link rel="icon">` element. Called from `loadIntoEditor`/`startNewDoc` in `app.js` whenever the open doc changes, so different tabs are visually distinguishable. `favicon.svg` is a static fallback for the brief window before JS finishes booting.
- **Slugs + doc links** (`edit/#/<slug>`): a slug is assigned at doc creation (`uniqueSlug("Untitled")`, so a never-renamed doc is still linkable as `#/untitled`, `#/untitled-2`, ...) and *locks in* the first time the doc gets a real title — `persistNow` only regenerates the slug while it's still an `untitled(-N)?` placeholder. This means a link stays valid through later renames, which is the actual point of having one. `bootDoc` checks `location.hash` before falling back to `edit.lastOpen.v1`, so a doc link always wins over "resume where I left off." A `hashchange` listener means pasting a doc link into an *already-open* tab navigates live rather than requiring a reload. Docs saved before this feature get a slug backfilled the first time they're loaded (`loadIntoEditor`'s `record.slug ||` fallback, immediately persisted).
- Prompt hardening: a live pass had a passive-voice run flag several already-active sentences with notes like "this is fine, leave it" — the model was treating "find X" as "survey every sentence and report on it" rather than "only report genuine issues." Fixed with an explicit rule in `buildPrompt` ("if you catch yourself about to write a note like 'this is fine, leave it,' that means you should not report it at all") plus a more precise passive-voice pass instruction. This is a prompt-only fix — no code path to unit-test it against, so it's worth keeping an eye on with real usage rather than considered fully closed.

## Workflow

Merge to `main` frequently (after each build phase at minimum) — Isaac tests on the live `hepwori.github.io/edit/` deployment, not just a local server. See the plan for the full phase breakdown; this file gets updated as phases land.

## Verifying changes

No test framework (matches repo convention). Serve locally and check in a real browser:
```
cd edit && http-server -p 8080 .
# or: python3 -m http.server 8080
```
