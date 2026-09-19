// Per-doc favicon: a small 5x5 symmetric identicon, seeded by a SHA-1 hash
// of the doc's id, so different open docs are visually distinguishable in
// browser tabs. Same idea as Isaac's own favidenticon Chrome extension
// (github.com/hepwori/favidenticon, itself based on identicon.js by
// Stewart Lord) — reimplemented here natively: WebCrypto for the hash, SVG
// for the image, no external library or build step needed.

async function sha1Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 5x5 grid mirrored left-right (col 2 is the center; 1&3 and 0&4 mirror),
// one cell per hex digit of hash[0..14] — even digit "on". Hue comes from
// the last 7 hex digits, matching identicon.js's approach.
function buildSvg(hash, size = 64) {
  const cell = size / 5;
  const hue = Math.round((parseInt(hash.slice(-7), 16) / 0xfffffff) * 360);
  const fg = `hsl(${hue}, 62%, 48%)`;
  const bg = "#faf8f5"; // --paper
  let rects = "";
  for (let i = 0; i < 15; i++) {
    if (parseInt(hash[i], 16) % 2 !== 0) continue;
    const row = i < 5 ? i : i < 10 ? i - 5 : i - 10;
    const cols = i < 5 ? [2] : i < 10 ? [1, 3] : [0, 4];
    for (const col of cols) {
      rects += `<rect x="${col * cell}" y="${row * cell}" width="${cell}" height="${cell}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${bg}"/><g fill="${fg}">${rects}</g></svg>`;
}

let linkEl = null;
let lastDocId = null;

export async function setDocFavicon(docId) {
  if (!docId || docId === lastDocId) return;
  lastDocId = docId;
  const hash = await sha1Hex(docId);
  if (docId !== lastDocId) return; // a newer doc switch beat this one to the punch
  const svg = buildSvg(hash);
  if (!linkEl) {
    linkEl = document.querySelector('link[rel="icon"]') || document.createElement("link");
    linkEl.rel = "icon";
    linkEl.type = "image/svg+xml";
    if (!linkEl.isConnected) document.head.appendChild(linkEl);
  }
  linkEl.href = "data:image/svg+xml;base64," + btoa(svg);
}
