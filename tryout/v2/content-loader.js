/* ══ Content loader ════════════════════════════════════════
   Fetches content.json (editable via /tryout/v2/admin/ — Decap CMS) and
   overlays it onto the page, then loads app.js. Loading app.js only after
   content is applied (rather than in parallel) matters because app.js's
   hero entrance animation restructures the title text into wrapped spans;
   the real text needs to be in place before that happens.

   Progressive enhancement: every element here already has real Hebrew text
   baked into index.html. If content.json is missing, fails to load, or is
   missing a key, that element simply keeps its existing text — the page
   never shows blank or broken content. ══════════════════════════════════ */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* Renders a program card's body from the plain-text convention already used
   in content.json: blocks separated by a blank line, each block is an
   optional heading line followed by "✔ "/"✓ " bullet lines. This mirrors
   exactly how the copy is already written, so editing it needs no HTML
   knowledge — just the same plain-text pattern. */
function renderCardBody(text) {
  const blocks = text.split(/\n\s*\n/);
  let html = '';
  blocks.forEach(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const bulletLines = lines.filter(l => l.startsWith('✔') || l.startsWith('✓'));
    const titleLines  = lines.filter(l => !l.startsWith('✔') && !l.startsWith('✓'));
    titleLines.forEach(t => {
      html += `<p class="card__group-title card__group-title--sub">${escapeHtml(t)}</p>`;
    });
    if (bulletLines.length) {
      html += '<ul class="card__list">' + bulletLines.map(b => `<li>${escapeHtml(b)}</li>`).join('') + '</ul>';
    }
  });
  return html;
}

function applyContent(data) {
  if (!data || typeof data !== 'object') return;

  // Plain text fields — textContent only, never parsed as HTML
  document.querySelectorAll('[data-cms]').forEach(el => {
    const key = el.getAttribute('data-cms');
    const val = data[key];
    if (val === undefined || val === null || val === '') return;
    el.textContent = val;
    if (el.hasAttribute('data-count')) el.setAttribute('data-count', val);
  });

  // Fields that may contain a manual line break ("\n" -> <br/>), escaped first
  document.querySelectorAll('[data-cms-html]').forEach(el => {
    const key = el.getAttribute('data-cms-html');
    const val = data[key];
    if (val === undefined || val === null || val === '') return;
    el.innerHTML = escapeHtml(val).replace(/\n/g, '<br/>');
  });

  // The hero's second title line keeps its gold-highlight treatment, just
  // applied to the whole (possibly edited) line instead of part of it
  document.querySelectorAll('[data-cms-gold]').forEach(el => {
    const key = el.getAttribute('data-cms-gold');
    const val = data[key];
    if (val === undefined || val === null || val === '') return;
    el.innerHTML = `<em>${escapeHtml(val)}</em>`;
  });

  // Program card bodies — rendered from the plain-text bullet convention
  document.querySelectorAll('[data-cms-body]').forEach(el => {
    const key = el.getAttribute('data-cms-body');
    const val = data[key];
    if (val === undefined || val === null || val === '') return;
    el.innerHTML = renderCardBody(val);
  });

  // Hero photo
  if (data.heroPhoto) {
    const img = document.getElementById('hero-photo');
    const fallback = document.querySelector('.hero__portrait-fallback');
    if (img) {
      img.src = data.heroPhoto;
      img.addEventListener('load', () => { if (fallback) fallback.hidden = true; }, { once: true });
    }
  }
}

function loadAppJs() {
  const s = document.createElement('script');
  s.src = 'app.js';
  document.body.appendChild(s);
}

fetch('content.json')
  .then(r => (r.ok ? r.json() : null))
  .catch(() => null)
  .then(data => {
    try { applyContent(data); } catch (e) { /* keep the static fallback text on any error */ }
    loadAppJs();
  });
