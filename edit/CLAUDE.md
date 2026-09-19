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
│   ├── provider.js   registry: provider id -> {label, defaultModel, testConnection, ...}
│   ├── gemini.js      Gemini AI Studio REST client, called directly from the browser
│   └── claude.js       Anthropic Messages API client, direct-browser-access header
```

Later phases add: `review.js` (the pass engine, using `llm/provider.js`),
`generative.js` (outline mode).

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

## Workflow

Merge to `main` frequently (after each build phase at minimum) — Isaac tests on the live `hepwori.github.io/edit/` deployment, not just a local server. See the plan for the full phase breakdown; this file gets updated as phases land.

## Verifying changes

No test framework (matches repo convention). Serve locally and check in a real browser:
```
cd edit && http-server -p 8080 .
# or: python3 -m http.server 8080
```
