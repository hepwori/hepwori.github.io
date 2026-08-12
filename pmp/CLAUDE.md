# CLAUDE.md

Working notes for Claude on this project.

## What this is

A pattern language for product management in complex organizations, authored by Isaac Hepworth. Patterns are extracted from real career experiences — stories of recurring dynamics that stood out as significant. The collection is an authored work, not a wiki.

## How the site works

- `content/index.json` — site index; lists all published patterns by category with slug, title, and summary. **Adding a pattern here is what makes it appear in the nav and ToC.**
- `content/patterns/<slug>.md` — one file per pattern, with YAML frontmatter
- `content/introduction.md` and `content/about.md` — static pages
- `drafts/` — work-in-progress patterns and scratchpad notes (not served by the site)
- `app.js` — single-page app; routes via the History API (`pushState`/`popstate`), fetches and renders markdown
- `style.css` — all styles
- `index.html` — shell; sidebar title is hardcoded short form

## Deployment & serving

This directory is the only source of truth for content and code — it's served two ways simultaneously, and both are just views onto these same files:

- **`hepwori.github.io/pmp/`** — plain GitHub Pages, serving this directory as static files. No build step.
- **`isaa.ch/patterns/`** — the promoted public URL. A Cloudflare Worker (`isaa-ch-patterns`, source in `cloudflare-worker.js`, deployed via `wrangler deploy`) is bound to a Workers Route `isaa.ch/patterns*` on the `isaa.ch` zone. It reverse-proxies asset requests (anything with a file extension) straight to the matching path on `hepwori.github.io/pmp/`, and serves the SPA shell (`index.html`, with a `<base href="/patterns/">` tag injected via `HTMLRewriter`) for every other sub-path — the standard SPA-fallback trick, needed because GitHub Pages has no server-side rewrite of its own.

`app.js`'s router doesn't hardcode either mount point — at load it reads `document.baseURI` (which reflects the injected `<base>` tag on isaa.ch, or the page's own natural URL on GitHub Pages) to work out where it's mounted, then builds all internal links and parses `location.pathname` relative to that. This is why the same unmodified files work correctly served from `/pmp/` in one place and `/patterns/` in the other.

**Why the Worker exists at all, and why it's scoped so narrowly**: `isaa.ch`'s apex is *also* a short.io "branded links" custom domain — 16 personal short links, including the bare root (`isaa.ch/` → his Twitter profile, ~7.7k clicks) and `/cv` (résumé). The Worker's route is deliberately just `isaa.ch/patterns*`, and only the two apex `A` records were switched from "DNS only" to "Proxied" to make the route reachable at all — everything else on the zone (the short.io links, `home.isaa.ch` → Home Assistant, `mail.isaa.ch`, the Bluesky `_atproto` TXT record) is untouched and must stay that way. Full history of this zone — DNS migration off Media Temple, the short.io link inventory, the Worker cutover — lives in the separate `domain-audit` project's tracker (`~/Documents/projects/domain-audit/tracker.md`, findings #17–#42), not here; that's the place to check before touching `isaa.ch` DNS/routing again, and to update if you do.

To redeploy the Worker after editing `cloudflare-worker.js`: `cd pmp && npx wrangler deploy` (needs `wrangler login` once, which opens a Cloudflare OAuth flow).

## Pattern file format

```
---
title: Pattern Title
also_known_as: Alternative Name (optional)
category: category-id
summary: One sentence.
---

## Context
## Problem
## Forces
## Navigation Strategies
## Consequences
## Known Uses        (optional)
## Related Patterns
```

Sections are consistent across patterns. "Degeneration" sub-sections appear under Consequences when relevant.

## Wikilinks

Cross-references use `[[Pattern Title]]` syntax — processed by `app.js` into links. Use the exact pattern title as it appears in the frontmatter.

## Adding a new pattern

1. Create `content/patterns/<slug>.md`
2. Add entry to `content/index.json` under the appropriate category
3. Update Related Patterns in other patterns that should reference the new one

## Editorial voice

- Neutral and descriptive, not prescriptive or moral
- Patterns describe how things *tend* to work, not how they *should* work
- No TED Talk framing — direct, no emotional fanfare
- Short paragraphs, confident tone

## Division of labor: About vs Introduction

- **Introduction** — what the collection is and how to use it
- **About** — who wrote it and why (personal provenance, authorship stance)

These should not overlap. The "descriptive not prescriptive" point lives in the Introduction.

## Title structure

- Canonical title: *A Pattern Language for Product Management in Complex Organizations*
- Short form (sidebar, browser tab): *A Pattern Language for Product Management*
- Both stored in `index.json` as `title` and `title_short`

## Drafts workflow

- `drafts/scratchpad.md` — raw exploration, story fragments, candidate patterns not yet named or structured
- `drafts/<slug>.md` — individual draft files once a pattern has a name and rough section shape
- When ready: move to `content/patterns/`, add to `index.json`, update cross-references
