// Gemini via the AI Studio REST API, called directly from the browser.
// generativelanguage.googleapis.com sends Access-Control-Allow-Origin: *,
// so a plain fetch with the key in x-goog-api-key works, no proxy needed
// (confirmed during planning — this is Google's own supported "client
// app" usage pattern, same as AI Studio's own "Get code" snippets).

const FINDINGS_SCHEMA = {
  type: "OBJECT",
  properties: {
    findings: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          quote: { type: "STRING" },
          note: { type: "STRING" },
          suggestion: { type: "STRING" },
          category: { type: "STRING" },
        },
        required: ["quote", "note"],
      },
    },
  },
  required: ["findings"],
};

const OUTLINE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    headings: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" },
          prompt: { type: "STRING" },
        },
        required: ["text", "prompt"],
      },
    },
  },
  required: ["headings"],
};

// Shared by runPass and generateOutline — both just want "call the model
// with this prompt, get JSON back matching this schema."
async function generateJSON({ apiKey, model, prompt, schema }) {
  if (!apiKey) throw new Error("Missing API key");
  if (!model) throw new Error("Missing model id");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    }),
  });

  if (!res.ok) throw new Error(await describeError(res));

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini responded with no content");
  return JSON.parse(text);
}

// prompt is a single fully-built user turn (see review.js) — Gemini's
// generateContent is single-turn-friendly and keeps this symmetric with
// Claude's runPass below.
export async function runPass({ apiKey, model, prompt }) {
  const parsed = await generateJSON({ apiKey, model, prompt, schema: FINDINGS_SCHEMA });
  return { findings: Array.isArray(parsed.findings) ? parsed.findings : [] };
}

// prompt is built by generative.js — structure only, no body prose (see
// its buildPrompt for the constraint spelled out to the model).
export async function generateOutline({ apiKey, model, prompt }) {
  const parsed = await generateJSON({ apiKey, model, prompt, schema: OUTLINE_SCHEMA });
  return { title: parsed.title || "", headings: Array.isArray(parsed.headings) ? parsed.headings : [] };
}

export async function testConnection({ apiKey, model }) {
  if (!apiKey) throw new Error("Missing API key");
  if (!model) throw new Error("Missing model id");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Reply with exactly one word: ok" }] }],
    }),
  });

  if (!res.ok) throw new Error(await describeError(res));

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("Gemini responded with no text — unexpected response shape");
  return { ok: true, reply: text };
}

async function describeError(res) {
  const body = await res.text().catch(() => "");
  try {
    const message = JSON.parse(body)?.error?.message;
    if (message) return `Gemini ${res.status}: ${message}`;
  } catch {
    // fall through to the generic message below
  }
  return `Gemini ${res.status} ${res.statusText}`;
}
