// Claude via the Messages API, called directly from the browser using
// Anthropic's documented bring-your-own-key pattern: the
// anthropic-dangerous-direct-browser-access header opts into CORS support
// (confirmed during planning). The "dangerous" naming is about embedding a
// key you don't own in a page others load — not applicable here, since
// each user supplies and stores only their own key, locally.

const FINDINGS_TOOL = {
  name: "report_findings",
  description: "Report copyediting findings as structured data.",
  input_schema: {
    type: "object",
    properties: {
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            quote: {
              type: "string",
              description:
                "The exact, character-for-character substring from the document this finding is about. Keep it as short and precise as the issue allows — just the span that needs to change, not extra surrounding context (put that in note instead).",
            },
            note: { type: "string", description: "A short explanation of what you noticed and why it matters. Any reasoning or description of a fix goes here, never in suggestion." },
            suggestion: {
              type: "string",
              description:
                "ONLY the exact replacement text for the ENTIRE quote, suitable for a direct drop-in swap when the author clicks Accept — a partial replacement would silently delete whatever part of quote it leaves out, so narrow quote down first if only a fragment of it actually changes. No commentary, no explanation, no prefacing like \"Consider...\" or \"Fix X; simplify to...\", no surrounding quotation marks. Omit this field entirely if there's no single concrete replacement.",
            },
            category: { type: "string" },
          },
          required: ["quote", "note"],
        },
      },
    },
    required: ["findings"],
  },
};

const OUTLINE_TOOL = {
  name: "generate_outline",
  description: "Propose a title, headings, and a starter question per heading for a piece of writing.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      headings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            prompt: { type: "string" },
          },
          required: ["text", "prompt"],
        },
      },
    },
    required: ["headings"],
  },
};

// Shared by runPass and generateOutline — forced tool-use is Claude's
// structured-output mechanism: it's obligated to call the named tool, so
// the response is always the shape we asked for rather than free text
// we'd have to parse hopefully.
async function callTool({ apiKey, model, prompt, tool, maxTokens = 4096 }) {
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
      max_tokens: maxTokens,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(await describeError(res));

  const data = await res.json();
  const toolUse = data?.content?.find((block) => block.type === "tool_use");
  if (!toolUse) throw new Error(`Claude responded without the expected ${tool.name} tool call`);
  return toolUse.input || {};
}

export async function runPass({ apiKey, model, prompt }) {
  const input = await callTool({ apiKey, model, prompt, tool: FINDINGS_TOOL });
  return { findings: Array.isArray(input.findings) ? input.findings : [] };
}

// prompt is built by generative.js — structure only, no body prose.
export async function generateOutline({ apiKey, model, prompt }) {
  const input = await callTool({ apiKey, model, prompt, tool: OUTLINE_TOOL, maxTokens: 2048 });
  return { title: input.title || "", headings: Array.isArray(input.headings) ? input.headings : [] };
}

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
