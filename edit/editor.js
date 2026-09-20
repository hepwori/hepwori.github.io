// Tiptap editor setup. Loaded straight from esm.sh, no build step, matching
// every other project in this repo. All @tiptap/* imports are pinned to the
// same version so esm.sh resolves a single shared @tiptap/pm (ProseMirror)
// instance across them instead of duplicates.

// Pinned version, shared @tiptap/pm dep (?deps=...) keeps every package on
// one ProseMirror instance instead of esm.sh resolving duplicates.
import { Editor, Mark, mergeAttributes } from "https://esm.sh/@tiptap/core@3.31.3?deps=@tiptap/pm@3.31.3";
import StarterKit from "https://esm.sh/@tiptap/starter-kit@3.31.3?deps=@tiptap/pm@3.31.3";
import Link from "https://esm.sh/@tiptap/extension-link@3.31.3?deps=@tiptap/pm@3.31.3";
import Placeholder from "https://esm.sh/@tiptap/extension-placeholder@3.31.3?deps=@tiptap/pm@3.31.3";
import { Markdown } from "https://esm.sh/@tiptap/markdown@3.31.3?deps=@tiptap/pm@3.31.3";
import { Plugin, PluginKey } from "https://esm.sh/@tiptap/pm@3.31.3/state?deps=@tiptap/pm@3.31.3";
import { Mapping } from "https://esm.sh/@tiptap/pm@3.31.3/transform?deps=@tiptap/pm@3.31.3";
import { createPasteHandler } from "./paste.js";
import { passBg } from "./passColors.js";

// A review finding, applied as a real mark so ProseMirror's position
// mapping keeps it attached to the right text as the doc is edited —
// for free, no bookkeeping needed on our end. Deliberately *not*
// registered with the Markdown extension (no parseMarkdown/renderMarkdown),
// so it's silently invisible to markdown export/copy — exported markdown
// is always clean, never carries `<mark data-review-id=...>` cruft.
export const ReviewFlag = Mark.create({
  name: "reviewFlag",
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-review-id"),
        renderHTML: (attrs) => ({ "data-review-id": attrs.id }),
      },
      passId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-pass-id"),
        renderHTML: (attrs) => ({ "data-pass-id": attrs.passId }),
      },
      passLabel: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-pass-label"),
        renderHTML: (attrs) => ({ "data-pass-label": attrs.passLabel }),
      },
      category: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-category"),
        renderHTML: (attrs) => (attrs.category ? { "data-category": attrs.category } : {}),
      },
      note: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-note"),
        renderHTML: (attrs) => ({ "data-note": attrs.note }),
      },
      suggestion: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-suggestion"),
        renderHTML: (attrs) => (attrs.suggestion ? { "data-suggestion": attrs.suggestion } : {}),
      },
      createdAt: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-created-at"),
        renderHTML: (attrs) => (attrs.createdAt ? { "data-created-at": attrs.createdAt } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: "mark.review-flag" }];
  },
  renderHTML({ HTMLAttributes }) {
    const bg = passBg(HTMLAttributes["data-pass-id"], HTMLAttributes["data-pass-label"]);
    return ["mark", mergeAttributes(HTMLAttributes, { class: "review-flag", style: `background:${bg}` }), 0];
  },

  // Editing text under a flag clears it — a stale suggestion for text
  // that's already changed isn't useful, and the author presumably just
  // addressed it themselves. Implemented as an appendTransaction plugin
  // (not app-level onUpdate logic) so it merges into the same transaction
  // batch as the edit itself: it undoes together with the edit as one
  // step, rather than being its own separate undo entry.
  //
  // "Touched" is decided by content, not position: map each existing
  // flag's old range forward through the transaction(s) via a real
  // ProseMirror Mapping, then compare the text at the old vs. mapped-new
  // range. Unchanged text (an edit elsewhere in the doc just shifted this
  // range's position) leaves the flag alone; changed text (an insertion,
  // deletion, or replacement inside it) clears it. This is why toggling
  // bold/italic on flagged text does *not* clear the flag — the
  // characters themselves didn't change, only their formatting.
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("reviewFlagAutoDismiss"),
        appendTransaction(transactions, oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const markType = newState.schema.marks.reviewFlag;
          if (!markType) return null;

          const runs = [];
          oldState.doc.descendants((node, pos) => {
            if (!node.isText) return;
            for (const mark of node.marks) {
              if (mark.type === markType) runs.push({ id: mark.attrs.id, from: pos, to: pos + node.nodeSize });
            }
          });
          if (runs.length === 0) return null;
          const byId = new Map();
          for (const run of runs) {
            const existing = byId.get(run.id);
            if (existing) {
              existing.from = Math.min(existing.from, run.from);
              existing.to = Math.max(existing.to, run.to);
            } else {
              byId.set(run.id, { ...run });
            }
          }

          const mapping = new Mapping();
          for (const tr of transactions) mapping.appendMapping(tr.mapping);

          let tr = null;
          for (const finding of byId.values()) {
            const newFrom = mapping.map(finding.from, -1);
            const newTo = mapping.map(finding.to, 1);
            if (newFrom >= newTo) continue; // flagged text was deleted outright — nothing left to un-mark
            const oldText = oldState.doc.textBetween(finding.from, finding.to, "￼", "￼");
            const newText = newState.doc.textBetween(newFrom, newTo, "￼", "￼");
            if (oldText !== newText) {
              if (!tr) tr = newState.tr;
              tr.removeMark(newFrom, newTo, markType);
            }
          }
          return tr;
        },
      }),
    ];
  },
});

export function createEditor({ element, content, onUpdate, onSelectionUpdate }) {
  // The paste handler needs the editor instance, which doesn't exist until
  // after `new Editor(...)` returns — so it's handed a thunk and the real
  // reference is filled in right after construction.
  let editorRef;
  const editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: "Start writing…" }),
      Markdown,
      ReviewFlag,
    ],
    content: content || "",
    editorProps: {
      handlePaste: createPasteHandler(() => editorRef),
    },
    onUpdate: onUpdate ? ({ editor }) => onUpdate(editor) : undefined,
    onSelectionUpdate: onSelectionUpdate ? ({ editor }) => onSelectionUpdate(editor) : undefined,
  });
  editorRef = editor;
  return editor;
}

export function getMarkdown(editor) {
  return editor.getMarkdown();
}

// opts.emitUpdate: false suppresses onUpdate — use it for programmatic loads
// (boot, switching docs in the library) that shouldn't trigger an autosave
// cycle of content that's already what's on disk.
export function setMarkdownContent(editor, markdown, opts = {}) {
  editor.commands.setContent(markdown || "", { contentType: "markdown", ...opts });
}

export function getJSON(editor) {
  return editor.getJSON();
}

export function setJSONContent(editor, json, opts = {}) {
  editor.commands.setContent(json || "", opts);
}

export function wordCount(editor) {
  const text = editor.getText();
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}
