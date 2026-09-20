// The review-pass engine: builds the prompt, calls the active provider,
// locates each returned finding's quote back in the live document, and
// applies it as a ReviewFlag mark (see editor.js). Also the read side —
// listing what's currently flagged, and accepting/dismissing a finding.
import { PROVIDERS } from "./llm/provider.js";

// The pass library itself now lives in storage.js's config (edit.config.v1
// .passes) — fully user-editable from Settings. This module just runs
// whatever instruction it's handed, named preset or ad-hoc custom text
// alike; it doesn't need to know where the instruction came from.

function buildPrompt({ instruction, docMarkdown, selectionText, styleGuide }) {
  const scopeNote = selectionText
    ? `The author has selected this specific passage and wants your review focused on it:\n\n"""\n${selectionText}\n"""\n\nThe full document is included below for context, but only raise findings elsewhere if directly relevant to the selected passage — otherwise stay focused on it.`
    : `Review the whole document below.`;

  const styleNote = styleGuide?.trim()
    ? `\n\nThe user adds this detail to help you understand the target style:\n"""\n${styleGuide.trim()}\n"""\nUse this as context for what "good" looks like for this piece. Flag departures from it where relevant, and don't suggest a fix that would fight against it.`
    : "";

  return `You are a careful, tactful copyeditor reviewing a piece of writing for its author. You flag things worth the author's attention — you never rewrite wholesale or add your own content. The author decides what to do with each note.${styleNote}

Task: ${instruction}

${scopeNote}

Rules for each finding:
- Every finding must represent something the author should actually reconsider or fix. NEVER report that a passage is already fine, already does the thing well, or needs no change — if you catch yourself about to write a note like "this is fine, leave it," that means you should not report it at all. Findings are for things worth changing, not a checklist of everything you looked at.
- "quote" must be copied VERBATIM, character-for-character, from the document text below — not paraphrased or summarized. It's used to locate the passage automatically; if it doesn't match exactly, the finding is silently dropped.
- Keep "note" short and specific: what you noticed and why it matters, not a lecture. Any reasoning, description of the fix, or commentary belongs here — never in "suggestion".
- "suggestion" is inserted verbatim in place of "quote" the moment the author clicks Accept, so it must be ONLY the exact replacement text: no commentary, no prefacing like "Consider..." or "Fix X; simplify to...", no explanation of what changed, no surrounding quotation marks. If you catch yourself writing anything other than drop-in prose into "suggestion", that content belongs in "note" instead. Only include "suggestion" when you have one concrete replacement in mind — omit it entirely for observations that need the author's own judgment (structural or tonal notes, "why doesn't this land" style questions, etc.).
- Report at most 15 findings, prioritizing the most useful ones.
- It is normal and expected to return an empty findings array if a pass genuinely finds nothing worth the author's attention — that's a good outcome, not a failure to try harder.

Document (markdown):
"""
${docMarkdown}
"""`;
}

// Runs a pass (named or ad-hoc) and applies whatever findings land cleanly
// as ReviewFlag marks in the live document. Scope (whole doc vs. the
// current selection) is implicit: if there's a selection when this is
// called, the pass is scoped to it.
export async function runReviewPass({ editor, providerId, apiKey, model, instruction, passId, passLabel, styleGuide }) {
  const provider = PROVIDERS[providerId];
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);

  const docMarkdown = editor.getMarkdown();
  const { from, to, empty } = editor.state.selection;
  const selectionText = empty ? null : editor.state.doc.textBetween(from, to, " ", " ").trim() || null;

  const prompt = buildPrompt({ instruction, docMarkdown, selectionText, styleGuide });
  const { findings } = await provider.runPass({ apiKey, model, prompt });

  const markType = editor.schema.marks.reviewFlag;
  const tr = editor.state.tr;
  const batchAt = new Date().toISOString();
  let applied = 0;
  let skipped = 0;
  for (const finding of findings) {
    if (!finding?.quote?.trim()) {
      skipped++;
      continue;
    }
    const range = findQuoteRange(editor.state.doc, finding.quote);
    if (!range) {
      skipped++;
      continue;
    }
    const id = `${passId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    tr.addMark(range.from, range.to, markType.create({
      id,
      passId,
      passLabel,
      category: finding.category || null,
      note: finding.note || "",
      suggestion: finding.suggestion || null,
      createdAt: batchAt,
    }));
    applied++;
  }
  if (applied > 0) editor.view.dispatch(tr);

  return { applied, skipped, total: findings.length, scoped: Boolean(selectionText) };
}

// Flattens the document into one string plus a per-character map back to
// real ProseMirror positions, so a quote found by a plain string/regex
// search can be translated back into a [from, to) range to mark.
function buildTextIndex(doc) {
  let text = "";
  const map = [];
  doc.descendants((node, pos) => {
    if (node.isText) {
      for (let i = 0; i < node.text.length; i++) map.push(pos + i);
      text += node.text;
    } else if (node.isBlock && text.length && !text.endsWith("\n")) {
      // Separates blocks so a quote can't accidentally span a paragraph
      // break; this synthetic character has no real position of its own,
      // so it borrows the block's start position (never actually used as
      // a match boundary in practice, since real quotes don't span it).
      map.push(pos);
      text += "\n";
    }
  });
  return { text, map };
}

// A single regex handles both an exact match and a whitespace-normalized
// one (the model sometimes collapses a line-wrapped quote's whitespace) by
// turning runs of whitespace in the quote into `\s+`.
function findQuoteRange(doc, quote) {
  const { text, map } = buildTextIndex(doc);
  const trimmed = quote.trim();
  if (!trimmed) return null;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped.replace(/\s+/g, "\\s+");
  let match;
  try {
    match = new RegExp(pattern).exec(text);
  } catch {
    return null;
  }
  if (!match || !match[0]) return null;
  const from = map[match.index];
  const to = map[match.index + match[0].length - 1] + 1;
  if (from == null || to == null) return null;
  return { from, to };
}

// ---- reading / resolving findings already applied to the doc ----

export function listFindings(editor) {
  const runs = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      if (mark.type.name === "reviewFlag") {
        runs.push({ id: mark.attrs.id, from: pos, to: pos + node.nodeSize, attrs: mark.attrs });
      }
    }
  });
  // A single logical finding can be split across adjacent text-node runs
  // (e.g. if an unrelated edit split the node); merge by id.
  const byId = new Map();
  for (const run of runs) {
    const existing = byId.get(run.id);
    if (existing) {
      existing.from = Math.min(existing.from, run.from);
      existing.to = Math.max(existing.to, run.to);
    } else {
      byId.set(run.id, { ...run.attrs, from: run.from, to: run.to });
    }
  }
  return [...byId.values()].sort((a, b) => a.from - b.from);
}

// Resolving a finding always removes its highlight. `applySuggestion: true`
// additionally replaces the flagged text with the suggestion first —
// `suggestionText` overrides `finding.suggestion` itself, so a tweak made
// in the sidebar's editable suggestion box before hitting Accept is what
// actually lands, not the model's original wording.
export function resolveFinding(editor, id, { applySuggestion = false, suggestionText } = {}) {
  const finding = listFindings(editor).find((f) => f.id === id);
  if (!finding) return false;
  const text = suggestionText != null ? suggestionText : finding.suggestion;
  const tr = editor.state.tr;
  const markType = editor.schema.marks.reviewFlag;
  if (applySuggestion && text) {
    // insertText deliberately carries over the marks active across the
    // replaced range (so bold/italic survive the edit) — which includes
    // our own reviewFlag mark. Strip just that one back off afterwards.
    tr.insertText(text, finding.from, finding.to);
    tr.removeMark(finding.from, finding.from + text.length, markType);
  } else {
    tr.removeMark(finding.from, finding.to, markType);
  }
  editor.view.dispatch(tr);
  return true;
}

// Plain dismiss for every open finding at once — no suggestions applied,
// just clears the highlights. For "run a check, skim it, clear it out."
export function dismissAllFindings(editor) {
  const findings = listFindings(editor);
  if (findings.length === 0) return 0;
  const tr = editor.state.tr;
  const markType = editor.schema.marks.reviewFlag;
  for (const f of findings) tr.removeMark(f.from, f.to, markType);
  editor.view.dispatch(tr);
  return findings.length;
}

// focusEditor: false updates the real ProseMirror selection (so the
// flagged span is visibly selected) without moving DOM focus into the
// editor's contenteditable. Card clicks use this — real editor focus() is
// scheduled by Tiptap on a later animation frame, which would otherwise
// silently steal focus back from the card a moment after it was set,
// breaking the up/down arrow-key navigation between cards.
export function focusFinding(editor, id, { focusEditor = true } = {}) {
  const finding = listFindings(editor).find((f) => f.id === id);
  if (!finding) return false;
  let chain = editor.chain();
  if (focusEditor) chain = chain.focus();
  chain.setTextSelection({ from: finding.from, to: finding.to }).run();
  // Not ProseMirror's own chain .scrollIntoView() command: it computes the
  // scroll target from the browser's *native* selection, which only
  // tracks a contenteditable's ProseMirror state while that element
  // actually has DOM focus — with focusEditor: false it silently no-ops
  // (confirmed via Playwright: clicking a card left scrollTop untouched).
  // Scrolling the mark's own DOM node works regardless of focus state, so
  // use that uniformly instead of two different mechanisms for one job.
  document.querySelector(`mark.review-flag[data-review-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center" });
  return true;
}
