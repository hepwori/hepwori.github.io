# pm interview question generator

a spoof of product-management interview questions. three slot-machine reels (task, product, audience) spin and land on something like "Suggest AI-powered features for a paperclip for cats".

- live: https://isaa.ch/toys/pmiqg/ (also `hepwori.github.io/pmiqg/`)
- **another** spins again; **link** copies a permalink to the current combination
- permalink fragment is three characters, one per reel: the item's position in its list, base 62 (`#000` is the first item of each). a bad or out-of-range fragment just falls back to a random spin
- respects `prefers-reduced-motion` (no animation, lands instantly)

single static file, `index.html`: no build, no dependencies (Montserrat from Google Fonts). edit the `tasks`, `products` and `audiences` arrays near the top of the script to change the content. append to the end of a list rather than reordering or deleting, or old permalinks will point at different items.
