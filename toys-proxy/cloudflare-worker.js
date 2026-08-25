/**
 * Cloudflare Worker bound to a Workers Route on isaa.ch: `isaa.ch/toys*`.
 *
 * Plain reverse proxy: isaa.ch/toys/<path> <-> hepwori.github.io/<path>,
 * unmodified. Unlike the isaa-ch-patterns worker (pmp/cloudflare-worker.js),
 * there's no HTML rewriting or SPA-shell fallback here — every project
 * under hepwori.github.io is a plain multi-page static site with
 * document-relative links, so a 1:1 path passthrough is all that's needed
 * for a page's own relative asset/link references to keep resolving
 * correctly once served under /toys/ instead of at the site root.
 *
 * Same scoping rule as the patterns worker: this route is additive on top
 * of the isaa.ch zone's existing short.io-fronted apex (root, /cv, and the
 * rest of the branded short links) and the isaa-ch-patterns route — it only
 * ever sees requests matching `/toys*`, so nothing else on the zone is
 * touched. See ~/Documents/projects/domain-audit/tracker.md for the zone's
 * full history.
 */

const MOUNT = '/toys';
const ORIGIN = 'https://hepwori.github.io';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Route binding should guarantee this, but don't assume it.
    if (url.pathname !== MOUNT && !url.pathname.startsWith(MOUNT + '/')) {
      return fetch(request);
    }

    const subPath = url.pathname === MOUNT ? '' : url.pathname.slice(MOUNT.length + 1);
    const lastSegment = subPath.split('/').pop();
    const isDirectoryMissingSlash = subPath !== '' && !subPath.endsWith('/') && !lastSegment.includes('.');

    // GitHub Pages 301s a bare directory path to add the trailing slash.
    // Redirect on isaa.ch ourselves instead of proxying that redirect
    // through, which would otherwise bounce the visitor to hepwori.github.io.
    if (isDirectoryMissingSlash) {
      url.pathname = `${MOUNT}/${subPath}/`;
      return Response.redirect(url.toString(), 301);
    }

    const upstream = await fetch(`${ORIGIN}/${subPath}${url.search}`);
    return new Response(upstream.body, upstream);
  },
};
