/**
 * Cloudflare Worker bound to a Custom Domain: `editor.isaa.ch`.
 *
 * Plain reverse proxy, whole-hostname version: editor.isaa.ch/<path> <->
 * hepwori.github.io/edit/<path>, unmodified. Same passthrough logic as
 * isaa-ch-toys (toys-proxy/cloudflare-worker.js), just mounted on a
 * dedicated subdomain instead of a /toys/<project> path, so this editor
 * gets its own origin for localStorage isolation - see edit/CLAUDE.md's
 * "localStorage compatibility policy". No HTML rewriting needed: this is a
 * single-page, no-build static app with document-relative links, not a
 * client-routed SPA with multiple served paths.
 */

const ORIGIN = 'https://hepwori.github.io/edit';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const lastSegment = url.pathname.split('/').pop();
    const isDirectoryMissingSlash = url.pathname !== '/' && !url.pathname.endsWith('/') && !lastSegment.includes('.');

    // GitHub Pages 301s a bare directory path to add the trailing slash.
    // Redirect on editor.isaa.ch ourselves instead of proxying that
    // redirect through, which would otherwise bounce the visitor to
    // hepwori.github.io.
    if (isDirectoryMissingSlash) {
      url.pathname = `${url.pathname}/`;
      return Response.redirect(url.toString(), 301);
    }

    const upstream = await fetch(`${ORIGIN}${url.pathname}${url.search}`);
    return new Response(upstream.body, upstream);
  },
};
