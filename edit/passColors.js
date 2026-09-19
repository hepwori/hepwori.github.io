// Pale, pass-specific color for both the sidebar finding cards and the
// in-editor highlight marks, so a reader can tell at a glance what kind of
// note something is without reading it first. Named passes (PASS_LIBRARY)
// get a fixed, memorable hue. A custom instruction has no natural color of
// its own, so its hue is hashed from the instruction text instead — the
// same question asked twice looks the same, different questions land on
// different (but still pastel, still "in family") hues. Same trick as the
// per-doc favicon identicons, just synchronous since this runs on every
// render rather than once per doc load.

const FIXED_HUES = {
  grammar: 142, // green
  flow: 205, // blue
  filler: 40, // amber
  passive: 275, // purple
  structure: 186, // teal
};

function hashHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function passHue(passId, passLabel) {
  if (passId && FIXED_HUES[passId] !== undefined) return FIXED_HUES[passId];
  return hashHue(passLabel || passId || "");
}

export function passBg(passId, passLabel) {
  return `hsl(${passHue(passId, passLabel)}, 55%, 91%)`;
}

export function passFg(passId, passLabel) {
  return `hsl(${passHue(passId, passLabel)}, 45%, 32%)`;
}
