// Tiptap editor setup. No build step, matching every other project in this
// repo — but unlike them, these imports resolve to files vendored in
// ./vendor/ rather than pulled live from esm.sh at runtime, so nothing
// executes from a third-party origin. See CLAUDE.md's "vendored
// dependencies" note and vendor/update-vendor.mjs for how/why.
import { Editor, Mark, Extension, mergeAttributes } from "./vendor/@tiptap/core@3.31.3.q-b43df6e3.mjs";
import StarterKit from "./vendor/@tiptap/starter-kit@3.31.3.q-b43df6e3.mjs";
import Link from "./vendor/@tiptap/extension-link@3.31.3.q-b43df6e3.mjs";
import Placeholder from "./vendor/@tiptap/extension-placeholder@3.31.3.q-b43df6e3.mjs";
import { Markdown } from "./vendor/@tiptap/markdown@3.31.3.q-b43df6e3.mjs";
import { Plugin, PluginKey } from "./vendor/@tiptap/pm@3.31.3/state.q-b43df6e3.mjs";
import { Mapping } from "./vendor/@tiptap/pm@3.31.3/transform.q-b43df6e3.mjs";
import { Decoration, DecorationSet } from "./vendor/@tiptap/pm@3.31.3/view.q-b43df6e3.mjs";
import { createPasteHandler } from "./paste.js";
import { passHueVar } from "./passColors.js";

// Which finding is "active" — its card and its in-editor highlight both
// get the darker treatment (see app.js's highlightCard). This is plugin
// state driven through a transaction meta, not a raw classList.toggle on
// a queried DOM node — an earlier version did that directly, and it lost
// races against ProseMirror's own DOM reconciliation: any redraw of the
// affected region (which a selection change can trigger even without a
// doc change) rebuilds the mark's DOM node from the schema, silently
// wiping a class ProseMirror doesn't know about. A Decoration is exactly
// the mechanism ProseMirror provides for ephemeral, position-tracked UI
// state that survives its own re-renders — confirmed via Playwright that
// the classList approach really did fail intermittently, the Decoration
// one doesn't.
export const activeFindingKey = new PluginKey("activeFindingHighlight");

export function setActiveFinding(editor, id) {
  editor.view.dispatch(editor.state.tr.setMeta(activeFindingKey, id || null));
}

// The browser only paints "selected text" while the contenteditable
// actually has focus — clicking into the ask box (or anywhere else that
// takes focus off the editor) makes a real, live ProseMirror selection
// invisible, even though it's still exactly there. Same fix shape as
// activeFindingKey above: a Decoration, toggled on/off via editor
// focus/blur (see createEditor's onFocus/onBlur below), recomputed from
// the *current* selection on every transaction while visible rather than
// a stashed range — so it also tracks correctly if something else moves
// the selection while the editor is blurred (e.g. clicking a finding
// card).
export const pendingSelectionKey = new PluginKey("pendingSelectionHighlight");

export function setPendingSelectionVisible(editor, visible) {
  editor.view.dispatch(editor.state.tr.setMeta(pendingSelectionKey, visible));
}

const PendingSelectionHighlight = Extension.create({
  name: "pendingSelectionHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pendingSelectionKey,
        state: {
          init() {
            return { visible: false, decorations: DecorationSet.empty };
          },
          apply(tr, prev, _oldState, newState) {
            const meta = tr.getMeta(pendingSelectionKey);
            const visible = meta !== undefined ? meta : prev.visible;
            const { from, to, empty } = newState.selection;
            const decorations =
              visible && !empty ? DecorationSet.create(newState.doc, [Decoration.inline(from, to, { class: "pending-scope" })]) : DecorationSet.empty;
            return { visible, decorations };
          },
        },
        props: {
          decorations(state) {
            return pendingSelectionKey.getState(state).decorations;
          },
        },
      }),
    ];
  },
});

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
    const hue = passHueVar(HTMLAttributes["data-pass-id"], HTMLAttributes["data-pass-label"]);
    // Background itself comes from style.css's `.tiptap mark.review-flag`
    // rule (theme-aware --pass-bg-s/-l tokens) — see passHueVar's comment.
    return ["mark", mergeAttributes(HTMLAttributes, { class: "review-flag", style: `--pass-hue:${hue}` }), 0];
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
      // See activeFindingKey/setActiveFinding above for why this is a
      // Decoration-backed plugin rather than direct DOM manipulation.
      // Decorations are recomputed fresh from the current document on
      // every relevant transaction (not mapped forward from a stashed
      // position), which also means the highlight is naturally correct
      // even if the active finding's mark moved because of an edit.
      new Plugin({
        key: activeFindingKey,
        state: {
          init() {
            return { activeId: null, decorations: DecorationSet.empty };
          },
          apply(tr, prev, _oldState, newState) {
            const meta = tr.getMeta(activeFindingKey);
            const activeId = meta !== undefined ? meta : prev.activeId;
            if (meta === undefined && !tr.docChanged) return prev;
            if (!activeId) return { activeId: null, decorations: DecorationSet.empty };
            const decos = [];
            newState.doc.descendants((node, pos) => {
              if (!node.isText) return;
              for (const mark of node.marks) {
                if (mark.type.name === "reviewFlag" && mark.attrs.id === activeId) {
                  decos.push(Decoration.inline(pos, pos + node.nodeSize, { class: "is-focused" }));
                }
              }
            });
            return { activeId, decorations: DecorationSet.create(newState.doc, decos) };
          },
        },
        props: {
          decorations(state) {
            return activeFindingKey.getState(state).decorations;
          },
        },
      }),
    ];
  },
});

export function createEditor({ element, content, onUpdate, onSelectionUpdate, onFocus, onBlur }) {
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
      PendingSelectionHighlight,
    ],
    content: content || "",
    editorProps: {
      handlePaste: createPasteHandler(() => editorRef),
    },
    onUpdate: onUpdate ? ({ editor }) => onUpdate(editor) : undefined,
    onSelectionUpdate: onSelectionUpdate ? ({ editor }) => onSelectionUpdate(editor) : undefined,
    onFocus: onFocus ? ({ editor }) => onFocus(editor) : undefined,
    onBlur: onBlur ? ({ editor }) => onBlur(editor) : undefined,
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
