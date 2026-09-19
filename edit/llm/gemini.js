// Gemini via the AI Studio REST API, called directly from the browser.
// generativelanguage.googleapis.com sends Access-Control-Allow-Origin: *,
// so a plain fetch with the key in x-goog-api-key works, no proxy needed
// (confirmed during planning — this is Google's own supported "client
// app" usage pattern, same as AI Studio's own "Get code" snippets).

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
