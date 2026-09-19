// Rich paste: HTML from the clipboard is flattened to markdown via
// turndown, then parsed through the same markdown pipeline as Import…
// (Tiptap's `insertContent(text, { contentType: "markdown" })`), so pasted
// formatting becomes real nodes instead of literal `**`/`#` characters.
// Plain-text paste that's clearly markdown source (copied from another .md
// file) gets the same treatment.
import TurndownService from "https://esm.sh/turndown@7.2.0";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
});
// Core turndown doesn't handle strikethrough; StarterKit does, so add it.
turndown.addRule("strikethrough", {
  filter: ["del", "s", "strike"],
  replacement: (content) => `~~${content}~~`,
});

// Deliberately conservative — false positives (ordinary prose that happens
// to contain an asterisk) are worse than occasionally missing a paste that
// was "technically" markdown.
function looksLikeMarkdown(text) {
  return /(^#{1,6}\s|\*\*[^*\n]+\*\*|__[^_\n]+__|^[-*+]\s|^\d+\.\s|\[[^\]]+\]\([^)]+\)|^>\s|^```)/m.test(text);
}

// Returns a ProseMirror `handlePaste` editorProp. `getEditor` is a thunk
// rather than the editor instance directly because this handler has to be
// supplied at Editor construction time, before the instance exists yet.
export function createPasteHandler(getEditor) {
  return (_view, event) => {
    const html = event.clipboardData?.getData("text/html");
    // ProseMirror's own copy (e.g. dragging a selection within the doc)
    // marks its HTML this way — let it fall through to native handling so
    // nothing round-trips through markdown and loses fidelity (marks that
    // don't have a markdown representation, like phase 5's review flags).
    if (html && html.includes("data-pm-slice")) return false;

    const editor = getEditor();
    if (!editor) return false;

    if (html) {
      const markdown = turndown.turndown(html);
      event.preventDefault();
      editor.chain().focus().insertContent(markdown, { contentType: "markdown" }).run();
      return true;
    }

    const text = event.clipboardData?.getData("text/plain");
    if (text && looksLikeMarkdown(text)) {
      event.preventDefault();
      editor.chain().focus().insertContent(text, { contentType: "markdown" }).run();
      return true;
    }

    return false;
  };
}
