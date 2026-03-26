/* ── State ─────────────────────────────────────────────────── */
let siteIndex = null;          // parsed _index.json
let slugToTitle = {};          // "alignment-mirage" → "Alignment Mirage"
let titleToSlug = {};          // "Alignment Mirage" → "alignment-mirage"
let slugToCategory = {};       // "alignment-mirage" → { id, title }

/* ── Boot ──────────────────────────────────────────────────── */
async function boot() {
  try {
    const res = await fetch('content/_index.json');
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
    }
  }

  buildNav();
  route();

  window.addEventListener('hashchange', route);

  document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Close sidebar when a nav link is clicked (mobile)
  document.getElementById('sidebar').addEventListener('click', e => {
    if (e.target.closest('a')) {
      document.getElementById('sidebar').classList.remove('open');
    }
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
      a.href = `#patterns/${p.slug}`;
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
  const hash = window.location.hash.replace(/^#\/?/, '');

  if (!hash || hash === '') {
    renderContents();
    setActive('contents');
    document.title = siteIndex.title;
    return;
  }

  if (hash === 'introduction') {
    loadMarkdownPage('content/introduction.md', null, 'introduction');
    document.title = `Introduction — ${siteIndex.title}`;
    return;
  }

  if (hash === 'about') {
    loadMarkdownPage('content/about.md', null, 'about');
    document.title = `About — ${siteIndex.title}`;
    return;
  }

  const patternMatch = hash.match(/^patterns\/(.+)$/);
  if (patternMatch) {
    const slug = patternMatch[1];
    loadPattern(slug);
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
    document.querySelector('a[href="#introduction"]')?.classList.add('active');
  } else if (type === 'about') {
    document.querySelector('a[href="#about"]')?.classList.add('active');
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

/* ── Wikilink processor ────────────────────────────────────── */
function processWikilinks(html) {
  // [[Pattern Title]] → linked pattern name
  return html.replace(/\[\[([^\]]+)\]\]/g, (match, title) => {
    // Try exact match first
    let slug = titleToSlug[title];

    // Try case-insensitive match
    if (!slug) {
      const lower = title.toLowerCase();
      slug = Object.keys(titleToSlug).find(t => t.toLowerCase() === lower)
               ? titleToSlug[Object.keys(titleToSlug).find(t => t.toLowerCase() === lower)]
               : null;
    }

    if (slug) {
      return `<a href="#patterns/${slug}">${title}</a>`;
    }
    return `<span class="broken-link">${title}</span>`;
  });
}

/* ── Markdown renderer ─────────────────────────────────────── */
function renderMarkdown(body) {
  const html = marked.parse(body);
  return processWikilinks(html);
}

/* ── Contents page ─────────────────────────────────────────── */
function renderContents() {
  const page = document.getElementById('page');

  let html = `
    <header class="page-header">
      <h1>${siteIndex.title}</h1>
    </header>
    <p class="contents-intro">${siteIndex.subtitle} · ${siteIndex.author}</p>
  `;

  for (const cat of siteIndex.categories) {
    html += `<section class="contents-category">
      <h2 class="contents-category-title">${cat.title}</h2>`;

    for (const p of cat.patterns) {
      html += `
        <div class="contents-pattern">
          <a href="#patterns/${p.slug}" class="contents-pattern-title">${p.title}</a>
          <span class="contents-pattern-summary">${p.summary}</span>
        </div>`;
    }

    html += `</section>`;
  }

  page.innerHTML = html;
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
    headerHtml += `<a href="#" class="pattern-category-label" onclick="event.preventDefault(); showCategory('${cat.id}')">${cat.title}</a>`;
  }
  headerHtml += `<h1>${title}</h1>`;
  if (meta.also_known_as) {
    headerHtml += `<p class="pattern-aka"><strong>Also known as:</strong> ${meta.also_known_as}</p>`;
  }
  headerHtml += `</header>`;

  const bodyHtml = renderMarkdown(mainBody);

  let relatedHtml = '';
  if (relatedBody.trim()) {
    relatedHtml = `<section class="related-patterns prose">
      <h2>Related Patterns</h2>
      ${renderMarkdown(relatedBody)}
    </section>`;
  }

  page.innerHTML = `
    ${headerHtml}
    <div class="prose">${bodyHtml}</div>
    ${relatedHtml}
  `;

  setActive('pattern', slug);
  scrollToTop();
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

function showCategory(catId) {
  // Navigate to contents and scroll to category (future enhancement)
  window.location.hash = '';
}

/* ── Go ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', boot);
