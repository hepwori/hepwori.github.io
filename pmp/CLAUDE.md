# CLAUDE.md

Working notes for Claude on this project.

## What this is

A pattern language for product management in complex organizations, authored by Isaac Hepworth. Patterns are extracted from real career experiences — stories of recurring dynamics that stood out as significant. The collection is an authored work, not a wiki.

## How the site works

- `content/index.json` — site index; lists all published patterns by category with slug, title, and summary. **Adding a pattern here is what makes it appear in the nav and ToC.**
- `content/patterns/<slug>.md` — one file per pattern, with YAML frontmatter
- `content/introduction.md` and `content/about.md` — static pages
- `drafts/` — work-in-progress patterns and scratchpad notes (not served by the site)
- `app.js` — single-page app; routes hash URLs, fetches and renders markdown
- `style.css` — all styles
- `index.html` — shell; sidebar title is hardcoded short form

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
