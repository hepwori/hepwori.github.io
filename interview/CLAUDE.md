# CLAUDE.md

Working notes for Claude on this project.

## What this is

A spoof PM-interview question generator by Isaac Hepworth. Three slot-machine reels (task / product / audience) spin and land on a combination. The humour comes from absurd collisions that still parse as PM-speak ("Suggest AI-powered features for a paperclip for cats"), so keep the content playful, not serious, and keep a few dry classics as ballast.

## Layout

- `index.html` — the whole thing: markup, CSS and JS inline. No build step, no deps beyond the Montserrat Google Font.
- `README.md` — short user-facing description.

## Deployment & serving

Plain GitHub Pages serves this directory at `hepwori.github.io/interview/`; the `isaa.ch/toys*` Cloudflare Worker (`toys-proxy/`) reverse-proxies it unchanged to `isaa.ch/toys/interview/`. Keep links document-relative so both mounts work (there are currently none). Formerly lived at `/pm`, then `/pmiqg`; both now 404 (the directory name is just `interview`, the project is still "PM interview question generator").

## How the code works

- Content is three arrays near the top of the script. Displayed strings are derived: products get an a/an article (`withArticle`), audiences get a `for ` prefix. A "reel" is `{ items (display strings), ms (spin duration) }`; durations are staggered (1400 / 2200 / 3000 ms) so they stop one after another.
- `spinReel` builds a strip: the currently displayed item, 18 random filler items, then the target. It transitions `translateY` by `--item` units (CSS custom property, so no JS measuring) with an ease-out curve, then adds `.landed`. Reduced motion skips the transition.
- Reel slot height: `--item` is two lines (2.4em) on narrow screens and one line (1.7em) at `min-width: 56rem`, where the longest strings fit on one line. If you add a longer string, recheck it at 896px and on a phone; a wrapped third line gets clipped.
- Accessibility: the reels are `aria-hidden` (they're churning filler). A `.sr-only` `aria-live` paragraph announces the full sentence only once all reels have landed. "another" is disabled and "link" is `aria-disabled` while spinning.

## Permalinks

- Fragment is `#` + one base-62 character per reel (`DIGITS`, 0-9a-zA-Z), the 0-based index of the item in its array. Max 62 items per list before the encoding runs out.
- On load, `picksFromHash` resolves the fragment; if the length is wrong or any ordinal is invalid/out of range it returns `null` and the spin is random. A valid fragment still spins with random filler and lands on those items, so it looks random.
- "link" does `history.replaceState` to put the fragment in the address bar, copies `location.href` (Clipboard API, `execCommand` textarea fallback), and briefly shows "copied". "another" clears the fragment, since it would no longer match.
- Deliberate tradeoff (Isaac's call): ordinals, not content hashes, so **reordering or deleting items breaks old links**. Append new items at the end of each array to keep them valid. Don't "fix" this without asking.

## Preferences / history

- Isaac likes it terse and restrained: baseline design, black background, yellow accent. Don't go wild on visuals unprompted.
- Title is "PM interview question generator" (not "slot machine"); button is lowercase "another".
- Isaac merges to `main` after each round so he can play with it live; the usual flow is a PR from the working branch, squash-merged.

## Testing

No test suite. Verified with headless Chromium (Playwright): spin lands, permalink round-trips in a fresh page, invalid fragments fall back to random, no horizontal scroll at 375px, no page errors. The sandbox lacks Montserrat, so wrapping at the 56rem breakpoint is worth a visual check on a real device after font changes. Not tested on Safari/iOS.
