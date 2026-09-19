/**
 * Cloudflare Worker bound to a Workers Route on isaa.ch: `isaa.ch/edit*`.
 *
 * Plain reverse proxy: isaa.ch/edit/<path> <-> hepwori.github.io/edit/<path>,
 * unmodified. No HTML rewriting or SPA-shell fallback needed (unlike the
 * isaa-ch-patterns worker, pmp/cloudflare-worker.js) -- /edit isn't a
 * pretty-URL router; it uses document-relative asset paths and a
 * client-side-only #/<slug> hash for doc links, which never reaches the
 * server at all. A 1:1 path passthrough is all that's needed for the
 * page's own relative references (style.css, app.js, ...) to keep
 * resolving correctly once served under /edit/ instead of at the site
 * root -- same idea as toys-proxy/cloudflare-worker.js, just mounted at
 * the same path on both sides instead of collapsing onto the repo root.
 *
 * Same scoping rule as the other isaa.ch workers: this route is additive
 * on top of the zone's existing short.io-fronted apex (root, /cv, and the
 * rest of the branded short links) and the isaa-ch-patterns / toys routes
 * -- it only ever sees requests matching `/edit*`, so nothing else on the
 * zone is touched. See ~/Documents/projects/domain-audit/tracker.md for
 * the zone's full history before touching isaa.ch DNS/routing again.
 *
 * localStorage is per-origin: this domain and hepwori.github.io/edit/ have
 * *separate* doc libraries and settings, not a synced one. Pick one as the
 * one you actually use.
 *
 * Deploy: `cd edit && npx wrangler deploy` (needs `wrangler login` once).
 */

const MOUNT = '/edit';
const ORIGIN = 'https://hepwori.github.io/edit';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Route binding should guarantee this, but don't assume it.
    if (url.pathname !== MOUNT && !url.pathname.startsWith(MOUNT + '/')) {
      return fetch(request);
    }

    // Bare /edit (no trailing slash) needs the slash added first, or this
    // page's own relative asset links (style.css, app.js, ...) would
    // resolve one directory too high once served from isaa.ch.
    if (url.pathname === MOUNT) {
      url.pathname = MOUNT + '/';
      return Response.redirect(url.toString(), 301);
    }

    const subPath = url.pathname.slice(MOUNT.length + 1);
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
