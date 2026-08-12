/**
 * Cloudflare Worker bound to a Workers Route on isaa.ch: `isaa.ch/patterns*`.
 *
 * Fronts the pmp SPA (which continues to live and deploy at
 * hepwori.github.io/pmp/, unchanged) at isaa.ch/patterns/* without touching
 * anything else on the isaa.ch zone — root, /cv, /transitions, and the rest
 * of the short.io-managed branded links keep flowing straight to short.io's
 * origin, since this worker only ever sees requests matching the route.
 *
 * Not run locally / not referenced by index.html — deployed directly via the
 * Cloudflare dashboard (Workers & Pages). Kept here for version control.
 */

const MOUNT = '/patterns';
const ORIGIN = 'https://hepwori.github.io/pmp';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Canonicalize the bare mount (no trailing slash) to the SPA root.
    if (url.pathname === MOUNT) {
      url.pathname = MOUNT + '/';
      return Response.redirect(url.toString(), 301);
    }

    // Route binding should guarantee this, but don't assume it.
    if (!url.pathname.startsWith(MOUNT + '/')) {
      return fetch(request);
    }

    const subPath = url.pathname.slice(MOUNT.length + 1); // "" | "absence-accounting" | "content/index.json" | …
    const lastSegment = subPath.split('/').pop();
    const isAsset = lastSegment.includes('.');

    // Static assets (style.css, app.js, content/*.md, content/index.json)
    // proxy straight through to the same path on the real origin.
    if (isAsset) {
      return fetch(`${ORIGIN}/${subPath}`);
    }

    // Every other sub-path is a client-side route (pattern slug,
    // "introduction", "about", or the home page) — serve the SPA shell
    // regardless of the exact path, same trick as Netlify's/Vercel's SPA
    // fallback. Inject a <base> tag so the shell's relative asset/link
    // references resolve against /patterns/ rather than /pmp/ (the
    // origin's own copy is untouched — this only affects what's served
    // via isaa.ch).
    return serveShell();
  },
};

async function serveShell() {
  const resp = await fetch(`${ORIGIN}/index.html`);
  return new HTMLRewriter()
    .on('head', {
      element(el) {
        el.append('<base href="/patterns/">', { html: true });
      },
    })
    .transform(new Response(resp.body, resp));
}
