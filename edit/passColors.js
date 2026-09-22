// Pale, pass-specific color for both the sidebar finding cards and the
// in-editor highlight marks, so a reader can tell at a glance what kind of
// note something is without reading it first. Named passes (PASS_LIBRARY)
// get a fixed, memorable hue. A custom instruction has no natural color of
// its own, so its hue is hashed from the instruction text instead — the
// same question asked twice looks the same, different questions land on
// different (but still pastel, still "in family") hues.

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

// Callers set this as an inline `--pass-hue` custom property on the
// element and let CSS (style.css's --pass-bg-s/-l and --pass-fg-s/-l
// tokens) compute the actual background/foreground colors from it, rather
// than baking a resolved hsl() string into the element here. That keeps a
// mark's or card's color following the live theme automatically —
// including a toggle after the mark was already rendered — with this
// module never needing to know or recompute anything about light vs. dark.
export function passHueVar(passId, passLabel) {
  return String(passHue(passId, passLabel));
}
