// Landing-page renderer (CONTENT.md §3). Reads the data-driven content, builds
// the page DOM, and mounts the converter through its PUBLIC API only.
//
// Isolation (CONTENT.md §2): this never reaches inside the converter. It imports
// StereoConverter from its public entry point and sets only the host's size and
// the --accent / --radius custom properties (done in CSS). No converter-internal
// selectors are touched.

import { content } from './content.js';
import { StereoConverter } from './converter/index.js';

/* ---- Tiny, safe inline markdown ------------------------------------------
 * Authored content only — but we still escape first, then apply a small subset:
 * **bold**, *italic*, `code`, and [text](url). Paragraphs split on blank lines.
 */
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inlineMd(s) {
  let t = escapeHtml(s);
  // links [text](url) — url is attribute-escaped by escapeHtml already
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, url) =>
    `<a href="${url}" rel="noopener noreferrer">${text}</a>`);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return t;
}

// Returns an array of <p> HTML strings from a markdown body.
function mdToParagraphs(body) {
  return body
    .split(/\n\n+/)
    .map((para) => `<p>${inlineMd(para.trim())}</p>`)
    .join('');
}

function el(tag, attrs = {}, html) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  if (html != null) node.innerHTML = html;
  return node;
}

/* ---- Build the page ------------------------------------------------------ */

function render() {
  document.documentElement.lang = content.lang || 'en';

  const page = document.getElementById('page');

  // Hero (§3.1)
  const hero = el('header', { class: 'hero' });
  hero.append(
    el('p', { class: 'eyebrow' }, escapeHtml(content.hero.eyebrow)),
    el('h1', {}, escapeHtml(content.hero.title)),
    el('p', { class: 'subtitle' }, escapeHtml(content.hero.subtitle)),
    el('p', { class: 'hook' }, inlineMd(content.hero.hook)),
    el('a', { class: 'cta', href: content.hero.cta.target },
      escapeHtml(content.hero.cta.label)),
  );
  page.append(hero);

  // Converter section (§3.2)
  const conv = content.converter;
  const convSection = el('section', { id: conv.id, class: 'converter-section' });
  convSection.append(el('h2', {}, escapeHtml(conv.title)));
  convSection.append(el('p', { class: 'section-intro' }, inlineMd(conv.intro)));
  if (conv.steps?.length) {
    const ol = el('ol', { class: 'steps' });
    for (const step of conv.steps) ol.append(el('li', {}, inlineMd(step)));
    convSection.append(ol);
  }
  // The host element the converter mounts into.
  const host = el('div', { id: 'converter' });
  convSection.append(host);
  if (conv.note) {
    convSection.append(el('p', { class: 'converter-note' }, inlineMd(conv.note)));
  }
  page.append(convSection);

  // History & science (§3.3 / §4)
  const history = el('section', { class: 'history' });
  history.append(el('h2', {}, 'History &amp; science'));
  for (const s of content.sections) {
    const entry = el('article', { class: 'history-entry', id: s.id });
    entry.append(el('h3', {}, escapeHtml(s.title)));
    entry.append(el('div', { class: 'prose' }, mdToParagraphs(s.body)));
    if (s.references?.length) {
      const refsWrap = el('p', { class: 'entry-refs' });
      refsWrap.append(document.createTextNode('Sources: '));
      s.references.forEach((rid, i) => {
        const idx = content.references.findIndex((r) => r.id === rid);
        if (idx === -1) return;
        const chip = el('a', {
          class: 'ref-chip',
          href: `#ref-${rid}`,
        }, `[${idx + 1}]`);
        refsWrap.append(chip);
      });
      entry.append(refsWrap);
    }
    history.append(entry);
  }
  page.append(history);

  // About (§3.4)
  const about = content.about;
  const aboutSection = el('section', { id: about.id, class: 'about' });
  aboutSection.append(el('h2', {}, escapeHtml(about.title)));
  aboutSection.append(el('div', { class: 'prose' }, mdToParagraphs(about.body)));
  if (about.credits?.length) {
    const dl = el('dl', { class: 'credits' });
    for (const c of about.credits) {
      const row = el('div', {});
      row.append(el('dt', { class: 'k' }, escapeHtml(c.label)));
      row.append(el('dd', { class: 'v' }, escapeHtml(c.value)));
      dl.append(row);
    }
    aboutSection.append(dl);
  }
  page.append(aboutSection);

  // Footer with full references (§3.5)
  const footer = el('footer', {});
  footer.append(el('h2', {}, 'References'));
  const ol = el('ol', { class: 'references' });
  content.references.forEach((r) => {
    const li = el('li', { id: `ref-${r.id}` });
    li.innerHTML = escapeHtml(r.text) +
      (r.url ? ` <a href="${escapeHtml(r.url)}" rel="noopener noreferrer">↗</a>` : '');
    ol.append(li);
  });
  footer.append(ol);

  const meta = el('div', { class: 'footer-meta' });
  if (content.footer.links?.length) {
    const links = el('ul', { class: 'footer-links' });
    for (const l of content.footer.links) {
      const li = el('li', {});
      li.append(el('a', { href: l.url, rel: 'noopener noreferrer' },
        escapeHtml(l.label)));
      links.append(li);
    }
    meta.append(links);
  }
  meta.append(el('p', {}, inlineMd(content.footer.license)));
  footer.append(meta);
  page.append(footer);

  return host;
}

/* ---- Mount converter via its public API (CONTENT.md §2; SPEC §0) --------- */

function mountConverter(host) {
  const converter = new StereoConverter(host, {
    defaultEngine: 'local',
    // callbackUrl defaults to this page's HTTPS URL (GitHub Pages) for OAuth.
  });
  converter.ready().then(() => {
    console.log('Converter ready:', converter.getCapabilities());
  }).catch((err) => {
    console.error('Converter failed to initialise:', err);
  });
  return converter;
}

const host = render();
mountConverter(host);
