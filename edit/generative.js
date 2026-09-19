// Generative outline mode: describe the piece, get back a suggested title,
// headings, and a starter question per section — structure only, never
// body prose. Same "structured JSON out" mechanics as review.js's passes
// (Gemini responseSchema / Claude forced tool-use), different schema.
import { PROVIDERS } from "./llm/provider.js";

function buildPrompt(description, styleGuide) {
  const styleNote = styleGuide?.trim()
    ? `\n\nThe author's target voice and style:\n"""\n${styleGuide.trim()}\n"""\nKeep this in mind when choosing headings and questions — they should suit this voice, not a generic one.`
    : "";

  return `You are helping an author plan the structure of a piece of writing, before they draft a single word of it. You suggest an outline — you never write any of the actual prose yourself, not even a sentence as an example.${styleNote}

The author describes what they want to write:
"""
${description}
"""

Suggest:
- A short, concrete title for the piece (a few words, specific to this piece — not generic like "My Essay").
- 3 to 8 headings that would give the piece a sensible structure, in the order they should appear.
- For each heading, one specific question that would help the author start drafting that section — something that prompts their own thinking, not a generic "write about X here" instruction.

Do not write any body content, example sentences, or filler text for the sections themselves. Title, headings, and prompt questions only.`;
}

export async function generateOutline({ providerId, apiKey, model, description, styleGuide }) {
  const provider = PROVIDERS[providerId];
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);
  const prompt = buildPrompt(description, styleGuide);
  return provider.generateOutline({ apiKey, model, prompt });
}

// Each heading becomes an H2 with its prompt question as an italicized
// placeholder paragraph right under it — a nudge to draft into, not real
// content. Deliberately plain markdown (no special marker/mark), so it
// behaves exactly like anything else the author writes: select it, delete
// it, replace it, whatever's natural once they start typing.
export function outlineToMarkdown({ title, headings }) {
  const lines = [`# ${(title || "Untitled").trim()}`, ""];
  for (const h of headings || []) {
    if (!h?.text) continue;
    lines.push(`## ${h.text}`, "");
    if (h.prompt) lines.push(`*${h.prompt}*`, "");
  }
  return lines.join("\n");
}
