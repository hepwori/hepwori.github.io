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
    };
  },
  parseHTML() {
    return [{ tag: "mark.review-flag" }];
  },
  renderHTML({ HTMLAttributes }) {
    const bg = passBg(HTMLAttributes["data-pass-id"], HTMLAttributes["data-pass-label"]);
    return ["mark", mergeAttributes(HTMLAttributes, { class: "review-flag", style: `background:${bg}` }), 0];
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
