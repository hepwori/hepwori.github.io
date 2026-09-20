// Regenerates this directory (edit/vendor/) — a same-origin mirror of the
// resolved esm.sh module graph for editor.js's and paste.js's third-party
// imports, so nothing executes from a third-party CDN at runtime (see
// CLAUDE.md's "vendored dependencies" note for the why).
//
// Usage (from the edit/vendor/ directory):
//   npm install es-module-lexer --no-save   # not committed — one-time, dev only
//   node update-vendor.mjs .
// then check the printed "Entry point local paths" against the imports at
// the top of ../editor.js and ../paste.js and update them if a filename
// changed (the content hash in "@pkg@version.q-<hash>.mjs" names is
// derived from the entry's exact query string, e.g. `?deps=...`, so it's
// stable across runs unless that query string itself changes).
//
// To bump a pinned version: edit ENTRY_POINTS below, delete this
// directory's contents except this script, and re-run.
//
// How it works: starting from ENTRY_POINTS, fetches each file, uses
// es-module-lexer (a real ES module parser, not regex — esm.sh's output is
// minified, e.g. `export*from"..."` with no whitespace around keywords,
// which an earlier regex-based version of this script silently missed) to
// find every import/export specifier, recursively follows each one, then
// rewrites every specifier in every file to a relative path pointing at
// its local copy.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { init, parse } from "es-module-lexer";

await init;

const ORIGIN = "https://esm.sh";
const OUT_DIR = process.argv[2] || "./out";

const ENTRY_POINTS = [
  { name: "tiptap-core", url: "https://esm.sh/@tiptap/core@3.31.3?deps=@tiptap/pm@3.31.3" },
  { name: "tiptap-starter-kit", url: "https://esm.sh/@tiptap/starter-kit@3.31.3?deps=@tiptap/pm@3.31.3" },
  { name: "tiptap-extension-link", url: "https://esm.sh/@tiptap/extension-link@3.31.3?deps=@tiptap/pm@3.31.3" },
  { name: "tiptap-extension-placeholder", url: "https://esm.sh/@tiptap/extension-placeholder@3.31.3?deps=@tiptap/pm@3.31.3" },
  { name: "tiptap-markdown", url: "https://esm.sh/@tiptap/markdown@3.31.3?deps=@tiptap/pm@3.31.3" },
  { name: "tiptap-pm-state", url: "https://esm.sh/@tiptap/pm@3.31.3/state?deps=@tiptap/pm@3.31.3" },
  { name: "tiptap-pm-transform", url: "https://esm.sh/@tiptap/pm@3.31.3/transform?deps=@tiptap/pm@3.31.3" },
  { name: "tiptap-pm-view", url: "https://esm.sh/@tiptap/pm@3.31.3/view?deps=@tiptap/pm@3.31.3" },
  { name: "turndown", url: "https://esm.sh/turndown@7.2.0" },
];

function resolveSpec(spec, fromUrl) {
  if (spec.startsWith("http://") || spec.startsWith("https://")) return spec;
  if (spec.startsWith("/")) return ORIGIN + spec;
  return new URL(spec, fromUrl).toString();
}

const KNOWN_EXT_RE = /\.(mjs|cjs|js|json|css|wasm|ts)$/i;

function localPathFor(urlStr) {
  const u = new URL(urlStr);
  let p = decodeURIComponent(u.pathname).replace(/^\/+/, "");
  const knownExt = p.match(KNOWN_EXT_RE);
  let ext;
  if (knownExt) {
    ext = knownExt[0];
  } else {
    ext = ".mjs";
    p += ext;
  }
  if (u.search) {
    const h = crypto.createHash("sha1").update(u.search).digest("hex").slice(0, 8);
    p = p.slice(0, p.length - ext.length) + ".q-" + h + ext;
  }
  return p;
}

const visited = new Map(); // url -> { localPath, content, specs: [{start, end, resolvedUrl}] }
const queue = [...ENTRY_POINTS.map((e) => e.url)];
const seen = new Set(queue);

async function crawl() {
  while (queue.length) {
    const url = queue.shift();
    process.stderr.write("fetching " + url + "\n");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`FAILED ${res.status} ${url}`);
    const content = await res.text();

    const [imports] = parse(content, url);
    const specs = [];
    for (const imp of imports) {
      // imp.specifier is the literal specifier text when statically
      // analyzable (static import, export-from, and the string-literal
      // form of dynamic import()) — absent for e.g. import(someVariable).
      // Note: for a "dynamic" import, start/end span the specifier
      // *including* its quotes; every other type excludes them — handled
      // below when rewriting.
      if (!imp.specifier) continue;
      const resolvedUrl = resolveSpec(imp.specifier, url);
      specs.push({ start: imp.start, end: imp.end, type: imp.type, resolvedUrl });
      if (!seen.has(resolvedUrl)) {
        seen.add(resolvedUrl);
        queue.push(resolvedUrl);
      }
    }
    visited.set(url, { localPath: localPathFor(url), content, specs });
  }
}

await crawl();

// second pass: rewrite each specifier's exact source-position span to a
// relative path — positional replacement (not string search/replace),
// immune to a specifier string appearing more than once with different
// meaning.
for (const [url, entry] of visited) {
  let out = "";
  let cursor = 0;
  const specsInOrder = [...entry.specs].sort((a, b) => a.start - b.start);
  for (const { start, end, type, resolvedUrl } of specsInOrder) {
    const target = visited.get(resolvedUrl);
    if (!target) throw new Error(`Missing crawled entry for ${resolvedUrl} (referenced from ${url})`);
    let rel = path.posix.relative(path.posix.dirname(entry.localPath), target.localPath);
    if (!rel.startsWith(".")) rel = "./" + rel;
    // "dynamic" import() specifiers span the quotes too; every other kind
    // (static import/export-from, export * from) excludes them.
    const replacement = type === "dynamic" ? `"${rel}"` : rel;
    out += entry.content.slice(cursor, start) + replacement;
    cursor = end;
  }
  out += entry.content.slice(cursor);
  entry.rewrittenContent = out;
}

for (const [, entry] of visited) {
  const outPath = path.join(OUT_DIR, entry.localPath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, entry.rewrittenContent);
}

console.log(`Wrote ${visited.size} files to ${OUT_DIR}`);
console.log("\nEntry point local paths:");
for (const e of ENTRY_POINTS) {
  console.log(`  ${e.name}: ${visited.get(e.url).localPath}`);
}
