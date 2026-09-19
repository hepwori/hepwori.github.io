// Claude via the Messages API, called directly from the browser using
// Anthropic's documented bring-your-own-key pattern: the
// anthropic-dangerous-direct-browser-access header opts into CORS support
// (confirmed during planning). The "dangerous" naming is about embedding a
// key you don't own in a page others load — not applicable here, since
// each user supplies and stores only their own key, locally.

export async function testConnection({ apiKey, model }) {
  if (!apiKey) throw new Error("Missing API key");
  if (!model) throw new Error("Missing model id");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 16,
      messages: [{ role: "user", content: "Reply with exactly one word: ok" }],
    }),
  });

  if (!res.ok) throw new Error(await describeError(res));

  const data = await res.json();
  const text = data?.content?.[0]?.text?.trim();
  if (!text) throw new Error("Claude responded with no text — unexpected response shape");
  return { ok: true, reply: text };
}

async function describeError(res) {
  const body = await res.text().catch(() => "");
  try {
    const message = JSON.parse(body)?.error?.message;
    if (message) return `Claude ${res.status}: ${message}`;
  } catch {
    // fall through to the generic message below
  }
  return `Claude ${res.status} ${res.statusText}`;
}
