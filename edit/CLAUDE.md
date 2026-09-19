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
├── index.html     shell: topbar/toolbar + editor pane (sidebar/modals added in later phases)
├── style.css
├── app.js         bootstrap: wires editor, toolbar, import/copy, toast
├── editor.js      Tiptap setup (StarterKit, Link, Placeholder, Markdown extension), markdown helpers
```

Later phases add: `paste.js` (rich paste via turndown), `storage.js` (doc library),
`review.js` + `llm/{provider,gemini,claude}.js` (review passes), `generative.js` (outline mode).

## Stack notes

- No npm, no bundler. Everything is `<script type="module">` importing straight from `esm.sh`, pinned to an exact `@tiptap/*` version (currently `3.31.3`) with `?deps=@tiptap/pm@<version>` on every import so esm.sh resolves one shared ProseMirror instance instead of duplicates — skipping that query param is a common source of "duplicate instance of prosemirror-state"-style breakage.
- `editor.js` uses the official `@tiptap/markdown` extension: `editor.getMarkdown()` to export, `editor.commands.setContent(md, { contentType: "markdown" })` to load. Confirmed working end-to-end (headings, emphasis, links, lists, blockquotes, fenced code blocks all round-trip cleanly).
- Gotcha hit once already, worth remembering: Tiptap's `onSelectionUpdate` fires **synchronously during `new Editor()` construction**. Any DOM lookups a callback touches must happen before `createEditor()` is called, or you get a "cannot access '<const>' before initialization" TDZ error that silently aborts the rest of a module's top-level code (which looks like "half the buttons don't work" with no obvious cause). See the ordering in `app.js`.
- Toolbar active-state (`.is-active`) needs refreshing on `onUpdate` as well as `onSelectionUpdate` — a mark toggle (bold, etc.) is a doc-changing transaction but doesn't necessarily change the selection range, so `onSelectionUpdate` alone leaves the toolbar stale after clicking its own buttons.

## Workflow

Merge to `main` frequently (after each build phase at minimum) — Isaac tests on the live `hepwori.github.io/edit/` deployment, not just a local server. See the plan for the full phase breakdown; this file gets updated as phases land.

## Verifying changes

No test framework (matches repo convention). Serve locally and check in a real browser:
```
cd edit && http-server -p 8080 .
# or: python3 -m http.server 8080
```
