/* ── State ─────────────────────────────────────────────────── */
let siteIndex = null;          // parsed _index.json
let slugToTitle = {};          // "alignment-mirage" → "Alignment Mirage"
let titleToSlug = {};          // "Alignment Mirage" → "alignment-mirage"
let slugToCategory = {};       // "alignment-mirage" → { id, title }
let slugToSummary = {};        // "alignment-mirage" → "The illusion of…"
let flatPatternOrder = [];     // [{ slug, title }, …] walked through categories in order

/* Where this document is mounted — "/pmp/" on GitHub Pages, "/patterns/" when
   served via the isaa.ch Cloudflare Worker (which injects a <base> tag).
   Fixed at load time; unaffected by later pushState calls. */
let mountPath = new URL(document.baseURI).pathname;
if (!mountPath.endsWith('/')) mountPath += '/';

function currentRouteSegment() {
  const path = window.location.pathname;
  if (!path.startsWith(mountPath)) return '';
  return path.slice(mountPath.length).replace(/\/+$/, '');
}

/* ── Boot ──────────────────────────────────────────────────── */
async function boot() {
  try {
    const res = await fetch('content/index.json');
    siteIndex = await res.json();
  } catch (e) {
    document.getElementById('page').innerHTML =
      '<p class="loading">Could not load site index. Make sure you\'re running a local server.</p>';
    return;
  }

  // Build lookup maps
  for (const cat of siteIndex.categories) {
    for (const p of cat.patterns) {
      slugToTitle[p.slug] = p.title;
      titleToSlug[p.title] = p.slug;
      slugToCategory[p.slug] = { id: cat.id, title: cat.title };
      slugToSummary[p.slug] = p.summary;
      flatPatternOrder.push({ slug: p.slug, title: p.title });
    }
  }

  buildNav();
  route();

  window.addEventListener('popstate', route);

  // Intercept clicks on in-app links and route via pushState instead of a
  // full page load (which would work too, via the Worker's SPA fallback on
  // isaa.ch — but wouldn't on a bare GitHub Pages load of a deep path).
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;

    let url;
    try {
      url = new URL(a.href);
    } catch (err) {
      return;
    }

    if (url.origin !== location.origin || !url.pathname.startsWith(mountPath)) return;

    e.preventDefault();
    const target = url.pathname + url.search;
    if (target !== location.pathname + location.search) {
      history.pushState(null, '', target);
      route();
    }
  });

  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  function closeSidebar() {
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
  }

  document.getElementById('menu-toggle').addEventListener('click', () => {
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('open');
  });

  backdrop.addEventListener('click', closeSidebar);

  // Close sidebar when a nav link is clicked (mobile)
  sidebar.addEventListener('click', e => {
    if (e.target.closest('a')) closeSidebar();
  });

  document.getElementById('nav-search').addEventListener('input', e => {
    filterNav(e.target.value);
  });
}

/* ── Sidebar search filter ────────────────────────────────────── */
function filterNav(query) {
  const q = query.trim().toLowerCase();

  document.querySelectorAll('.nav-category').forEach(section => {
    let anyVisible = false;

    section.querySelectorAll('li').forEach(li => {
      const a = li.querySelector('a');
      const slug = a.dataset.slug;
      const matches = !q ||
        a.textContent.toLowerCase().includes(q) ||
        (slugToSummary[slug] || '').toLowerCase().includes(q);
      li.classList.toggle('nav-link-hidden', !matches);
      if (matches) anyVisible = true;
    });

    section.classList.toggle('nav-category-hidden', !anyVisible);
  });
}

/* ── Navigation builder ────────────────────────────────────── */
function buildNav() {
  const container = document.getElementById('nav-categories');
  container.innerHTML = '';

  for (const cat of siteIndex.categories) {
    const section = document.createElement('div');
    section.className = 'nav-category';
    section.dataset.categoryId = cat.id;

    const catTitle = document.createElement('span');
    catTitle.className = 'nav-category-title';
    catTitle.textContent = cat.title;
    section.appendChild(catTitle);

    const ul = document.createElement('ul');
    for (const p of cat.patterns) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = p.slug;
      a.textContent = p.title;
      a.className = 'nav-link';
      a.dataset.slug = p.slug;
      li.appendChild(a);
      ul.appendChild(li);
    }
    section.appendChild(ul);
    container.appendChild(section);
  }
}

/* ── Router ────────────────────────────────────────────────── */
function route() {
  const seg = currentRouteSegment();

  if (!seg) {
    renderContents();
    setActive('contents');
    document.title = siteIndex.title;
    return;
  }

  if (seg === 'introduction') {
    loadMarkdownPage('content/introduction.md', null, 'introduction');
    document.title = `Introduction — ${siteIndex.title}`;
    return;
  }

  if (seg === 'about') {
    loadMarkdownPage('content/about.md', null, 'about');
    document.title = `About — ${siteIndex.title}`;
    return;
  }

  if (!seg.includes('/')) {
    loadPattern(seg);
    return;
  }

  // Fallback: contents
  renderContents();
  setActive('contents');
}

/* ── Active link state ─────────────────────────────────────── */
function setActive(type, slug) {
  document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));

  if (type === 'contents') {
    document.querySelector('.nav-contents')?.classList.add('active');
  } else if (type === 'introduction') {
    document.querySelector('a[href="introduction"]')?.classList.add('active');
  } else if (type === 'about') {
    document.querySelector('a[href="about"]')?.classList.add('active');
  } else if (type === 'pattern' && slug) {
    document.querySelector(`a[data-slug="${slug}"]`)?.classList.add('active');
  }
}

/* ── Fetch helper ──────────────────────────────────────────── */
async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/* ── Frontmatter parser ────────────────────────────────────── */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const meta = {};
  const yamlBlock = match[1];
  const body = match[2];

  // Simple key: value parser (no nested objects needed here)
  for (const line of yamlBlock.split('\n')) {
    const kv = line.match(/^(\w[\w_-]*):\s*(.*)$/);
    if (kv) {
      meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
    }
  }

  return { meta, body: body.trimStart() };
}

/* ── Wikilink resolution ───────────────────────────────────── */
function resolveWikilinkSlug(title) {
  if (titleToSlug[title]) return titleToSlug[title];

  const lower = title.toLowerCase();
  const match = Object.keys(titleToSlug).find(t => t.toLowerCase() === lower);
  return match ? titleToSlug[match] : null;
}

/* ── Wikilink processor ────────────────────────────────────── */
function processWikilinks(html) {
  // [[Pattern Title]] → linked pattern name
  return html.replace(/\[\[([^\]]+)\]\]/g, (match, title) => {
    const slug = resolveWikilinkSlug(title);
    if (slug) {
      return `<a href="${slug}">${title}</a>`;
    }
    return `<span class="broken-link">${title}</span>`;
  });
}

/* ── Related Patterns card parser ─────────────────────────────
   Parses bullets of the form `- [[Pattern Title]] — description`
   into the same card grid used for TOC/featured patterns. */
function renderRelatedCards(relatedBody) {
  const bulletRe = /^-\s*\[\[([^\]]+)\]\]\s*—\s*(.+)$/gm;
  let html = '<div class="toc-featured-grid">';
  let match;
  let found = false;

  while ((match = bulletRe.exec(relatedBody)) !== null) {
    found = true;
    const [, title, summary] = match;
    const slug = resolveWikilinkSlug(title);

    if (slug) {
      html += `
        <a href="${slug}" class="toc-featured-pattern">
          <span class="toc-featured-title">${title}</span>
          <span class="toc-featured-summary">${summary}</span>
        </a>`;
    } else {
      html += `
        <div class="toc-featured-pattern related-broken">
          <span class="toc-featured-title">${title}</span>
          <span class="toc-featured-summary">${summary}</span>
        </div>`;
    }
  }

  html += '</div>';
  return found ? html : null;
}

/* ── Markdown renderer ─────────────────────────────────────── */
function renderMarkdown(body) {
  const html = marked.parse(body);
  return processWikilinks(html);
}

/* ── Contents page ─────────────────────────────────────────── */
function renderContents() {
  const pageEl = document.getElementById('page');

  let html = `
    <div class="landing-header">
      <h1 class="landing-title">${siteIndex.title}</h1>
      <p class="landing-byline">${siteIndex.author}</p>
    </div>
    <p class="landing-description">${siteIndex.description}</p>
    <nav class="toc">
  `;

  // Background
  if (siteIndex.pages && siteIndex.pages.length) {
    html += `<div class="toc-block">
      <h2 class="toc-section-heading">Background</h2>
      <div class="toc-featured-grid">`;
    for (const pg of siteIndex.pages) {
      html += `
        <a href="${pg.slug}" class="toc-featured-pattern">
          <span class="toc-featured-title">${pg.title}</span>
          <span class="toc-featured-summary">${pg.summary}</span>
        </a>`;
    }
    html += `</div></div>`;
  }

  // Featured Patterns
  if (siteIndex.featured && siteIndex.featured.length) {
    html += `<div class="toc-block">
      <h2 class="toc-section-heading">Featured Patterns</h2>
      <div class="toc-featured-grid">`;
    for (const slug of siteIndex.featured) {
      html += `
        <a href="${slug}" class="toc-featured-pattern">
          <span class="toc-featured-title">${slugToTitle[slug]}</span>
          <span class="toc-featured-summary">${slugToSummary[slug]}</span>
        </a>`;
    }
    html += `</div></div>`;
  }

  // All Patterns
  html += `<div class="toc-block"><h2 class="toc-section-heading">All Patterns</h2>`;
  for (const cat of siteIndex.categories) {
    html += `<div class="toc-category-group">
      <h3 class="toc-category-subhead">${cat.title}</h3>
      <div class="toc-featured-grid">`;
    for (const p of cat.patterns) {
      html += `
        <a href="${p.slug}" class="toc-featured-pattern">
          <span class="toc-featured-title">${p.title}</span>
          <span class="toc-featured-summary">${p.summary}</span>
        </a>`;
    }
    html += `</div></div>`;
  }
  html += `</div>`;

  html += `</nav>`;

  pageEl.innerHTML = html;
  setActive('contents');
  scrollToTop();
}

/* ── Pattern page ──────────────────────────────────────────── */
async function loadPattern(slug) {
  const page = document.getElementById('page');
  page.innerHTML = '<div class="loading">Loading…</div>';

  let raw;
  try {
    raw = await fetchText(`content/patterns/${slug}.md`);
  } catch (e) {
    page.innerHTML = `<p class="loading">Pattern not found: <code>${slug}</code></p>`;
    return;
  }

  const { meta, body } = parseFrontmatter(raw);
  const cat = slugToCategory[slug];

  // Split out the Related Patterns section for special rendering
  const relatedSplit = body.split(/^## Related Patterns\s*$/m);
  const mainBody = relatedSplit[0];
  const relatedBody = relatedSplit[1] || '';

  const title = meta.title || slugToTitle[slug] || slug;
  document.title = `${title} — ${siteIndex.title}`;

  let headerHtml = `<header class="pattern-header">`;
  if (cat) {
    headerHtml += `<span class="pattern-breadcrumb">${cat.title}</span>`;
  }
  headerHtml += `<h1>${title}</h1>`;
  if (meta.also_known_as) {
    headerHtml += `<p class="pattern-aka"><strong>Also known as:</strong> ${meta.also_known_as}</p>`;
  }
  headerHtml += `</header>`;

  const bodyHtml = renderMarkdown(mainBody);

  let relatedHtml = '';
  if (relatedBody.trim()) {
    const cardsHtml = renderRelatedCards(relatedBody);
    if (cardsHtml) {
      relatedHtml = `<section class="related-patterns">
        <h2>Related Patterns</h2>
        ${cardsHtml}
      </section>`;
    }
  }

  page.innerHTML = `
    ${headerHtml}
    <div class="prose">${bodyHtml}</div>
    ${relatedHtml}
    ${renderPagination(slug)}
  `;

  setActive('pattern', slug);
  scrollToTop();
}

/* ── Prev / Next pagination ───────────────────────────────────── */
function renderPagination(slug) {
  const i = flatPatternOrder.findIndex(p => p.slug === slug);
  const prev = i > 0 ? flatPatternOrder[i - 1] : null;
  const next = i >= 0 && i < flatPatternOrder.length - 1 ? flatPatternOrder[i + 1] : null;

  if (!prev && !next) return '';

  let html = '<nav class="pattern-pagination">';
  html += prev
    ? `<a href="${prev.slug}" class="pagination-prev">← ${prev.title}</a>`
    : '<span></span>';
  html += next
    ? `<a href="${next.slug}" class="pagination-next">${next.title} →</a>`
    : '';
  html += '</nav>';
  return html;
}

/* ── Generic markdown page (intro, about) ──────────────────── */
async function loadMarkdownPage(path, title, activeType) {
  const page = document.getElementById('page');
  page.innerHTML = '<div class="loading">Loading…</div>';

  let raw;
  try {
    raw = await fetchText(path);
  } catch (e) {
    page.innerHTML = `<p class="loading">Could not load page.</p>`;
    return;
  }

  const { meta, body } = parseFrontmatter(raw);
  const pageTitle = title || meta.title || activeType;

  page.innerHTML = `
    <header class="page-header">
      <h1>${pageTitle}</h1>
    </header>
    <div class="prose">${renderMarkdown(body)}</div>
  `;

  setActive(activeType);
  scrollToTop();
}

/* ── Helpers ───────────────────────────────────────────────── */
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/* ── Go ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', boot);
