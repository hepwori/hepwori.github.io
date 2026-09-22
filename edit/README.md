# editor

a browser-based markdown editor with an AI copyediting layer, for personal writing. no server, no accounts, no build step — everything runs in your browser and saves to it.

live at [hepwori.github.io/edit](https://hepwori.github.io/edit/).

## using it

open the page and start writing. it's a normal WYSIWYG editor — **bold**, *italic*, headings, lists, blockquotes, code, links — that happens to store everything as markdown under the hood.

- **library** (top left) — every doc you write is saved locally in this browser, autosaved as you type. switch between docs, start a new one, delete old ones.
- **import…** — paste in a markdown draft from somewhere else and it replaces the current doc.
- **copy markdown** — grab the current doc as clean markdown, ready to paste elsewhere.
- pasting rich text (from a webpage, a doc) or raw markdown directly into the editor both convert to real formatting automatically.
- each doc gets a link (`edit/#/your-doc-title`) once you give it a real title, so you can bookmark or share a specific one.
- **dark mode** — follows your OS/browser setting automatically. Prefer it always on (or always off) regardless of that? Click the 🌙/☀️ button in the topbar to override; it remembers your choice.

### AI review

**settings** — plug in an API key for Gemini or Claude (whichever you have access to), pick a model, test the connection. keys are stored only in this browser and go straight to the provider, nowhere else.

also in settings: a **writing style** field — free text describing the voice you're going for (*"write like Matt Levine: dry, precise, digressive"*, or your own house style) — given as context to every review pass and the generative outline mode. and the **review passes** themselves are fully editable there: rename any of the built-in presets, rewrite what they ask for, add your own, remove ones you don't use.

**review panel** (right side, always visible) — run a copyediting pass over your doc. pick one of your presets (grammar, flow, filler words, passive voice, structure by default), or type something specific — *"this feels jargon-heavy"*, *"why doesn't this land?"* — and it'll review against that instead. select a passage first and the review focuses on just that selection (with the full doc still there for context). hit **Cmd/Ctrl+/** from anywhere (including while you're typing) to jump straight to the "ask something specific" box, then **Enter** (or Cmd/Ctrl+Enter) to run it. **Escape** takes you back to exactly where you were writing.

findings show up as highlighted spans in the text and cards in the sidebar, color-coded by which pass raised them, newest batch on top. click a card to jump the editor to that spot, or click into the card list and use **up/down arrow** to step through findings one at a time. for each one: **accept** (applies the suggested fix — editable first, if you want to tweak the wording), **dismiss** (clears it, no change), or **dismiss all** to clear everything from a pass at once. the AI only ever flags and suggests — it never rewrites your document for you.

some findings are about the piece as a whole rather than one specific passage — structural notes especially. those show up as ordinary cards too (sorted first within their pass, ahead of the specific ones) but with no in-text highlight to click into, since there's no single spot they're about — just read the note and **dismiss** when you've taken it in.

**debug** (top right) — the last 20 raw requests/responses sent to your LLM provider, if you want to see exactly what was asked and what came back. nothing's saved; it clears on reload, and your API key never appears in it (it's sent as a header, not part of the logged request body).

debug also has a couple of dev-facing tools: **export prompt defaults** dumps your current writing style + review passes as JSON, for handing to Claude when you want a good configuration to become the new shipped default. and two reset buttons — **reset settings to defaults** (clears your style guide/passes, keeps your docs and keys) and **reset everything** (docs, keys, all of it — the "start over from a blank slate" button).

### generative outline mode

**library → generate outline…** — describe the piece you want to write in a sentence or two and get back a title suggestion plus a set of headings, each with a starter question to help you begin drafting that section. it creates a new doc with that structure — no generated prose, ever, just something to draft into.

## philosophy

- **local-first** — no accounts, no cloud sync. your docs live in this browser's storage; a different browser or machine has its own separate library.
- **bring your own key** — no shared backend, no usage limits set by us. you supply your own Gemini or Claude API access.
- **the AI edits, it doesn't write** — review passes flag and suggest; the generative mode outlines structure. actual prose is always yours.
- **no build step** — plain HTML/CSS/JS, same as every other project in this repo.
- **no third-party code at runtime** — the editor's dependencies (Tiptap/ProseMirror, Turndown) are vendored into `edit/vendor/` rather than pulled live from a CDN, so nothing but this repo's own code ever runs in the page.

See `CLAUDE.md` in this folder for how it's built, the phased build order, and implementation notes.
