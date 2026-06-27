// Page renderer (CONTENT.md §3). Reads the data-driven content, builds the page
// DOM, and mounts the converter through its PUBLIC API only.
//
// Layout (pivot): the converter is the primary citizen — it owns the main page,
// like the original standalone app. The lecture/exhibition material (history &
// science, about, references) lives in a CURTAIN: a right-side drawer opened by
// a fixed action button in the bottom-right corner. People who only want the
// converter never have to scroll past the history; people who want the story
// pull the curtain.
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

/* ---- Primary page: the converter (§3.2) ---------------------------------- */

function buildMain(page) {
  const conv = content.converter;

  // Converter-focused header — restored from the original standalone app: a plain
  // title and one-line subtitle, with the converter as the headline act.
  const header = el('header', { class: 'app-header' });
  header.append(el('h1', {}, 'Stereoscope Converter'));
  header.append(el('p', { class: 'app-intro' },
    'Convert a single existing photo into a red/cyan 3D anaglyph — fully in ' +
    'your browser, no account required. Press the button in the bottom-right ' +
    'corner to explore the science and history behind it.'));
  page.append(header);

  const convSection = el('section', { id: conv.id, class: 'converter-section' });

  // The AI-mode note now sits at the TOP, above the converter.
  if (conv.note) {
    convSection.append(el('p', { class: 'converter-note' }, inlineMd(conv.note)));
  }

  // The host element the converter mounts into.
  const host = el('div', { id: 'converter' });
  convSection.append(host);

  page.append(convSection);

  return host;
}

/* ---- Curtain content: history & science, about, references (§3.1/3.3/3.4/3.5) */

function buildCurtainBody(body) {
  // History & science (§3.3 / §4)
  const history = el('section', { class: 'history' });
  for (const s of content.sections) {
    const entry = el('article', { class: 'history-entry', id: s.id });
    entry.append(el('h4', {}, escapeHtml(s.title)));
    entry.append(el('div', { class: 'prose' }, mdToParagraphs(s.body)));
    if (s.references?.length) {
      const refsWrap = el('p', { class: 'entry-refs' });
      refsWrap.append(document.createTextNode('Sources: '));
      s.references.forEach((rid) => {
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
  body.append(history);

  // About (§3.4)
  const about = content.about;
  const aboutSection = el('section', { id: about.id, class: 'about' });
  aboutSection.append(el('h3', {}, escapeHtml(about.title)));
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
  body.append(aboutSection);

  // References + footer meta (§3.5)
  const footer = el('footer', {});
  footer.append(el('h3', {}, 'References'));
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
  body.append(footer);
}

/* ---- Curtain shell + action button --------------------------------------- */

function buildCurtain() {
  const backdrop = el('div', { class: 'curtain-backdrop', hidden: 'hidden' });

  const curtain = el('aside', {
    id: 'curtain',
    class: 'curtain',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': content.hero.title,
    'aria-hidden': 'true',
  });

  const head = el('div', { class: 'curtain-head' });
  head.append(el('h2', { class: 'curtain-heading' }, 'History &amp; science'));
  const closeBtn = el('button', {
    class: 'curtain-close',
    type: 'button',
    'aria-label': 'Close',
  }, '&times;');
  head.append(closeBtn);
  curtain.append(head);

  const bodyWrap = el('div', { class: 'curtain-body' });
  buildCurtainBody(bodyWrap);
  curtain.append(bodyWrap);

  // Fixed action button, bottom-right corner. Icon-only — book glyph from Simple
  // Icons (BookStack). The accessible name comes from aria-label.
  const toggle = el('button', {
    class: 'curtain-toggle',
    type: 'button',
    'aria-expanded': 'false',
    'aria-controls': 'curtain',
    'aria-label': 'History of stereoscopy',
    title: 'History of stereoscopy',
  });
  toggle.innerHTML =
    '<svg class="curtain-toggle-icon" viewBox="0 0 24 24" width="24" height="24" ' +
    'fill="currentColor" aria-hidden="true">' +
    '<path d="M.3013 17.6146c-.1299-.3387-.5228-1.5119-.1337-2.4314l9.8273 ' +
    '5.6738a.329.329 0 0 0 .3299 0L24 12.9616v2.3542l-13.8401 7.9906-9.8586-5.6918zM' +
    '.1911 8.9628c-.2882.8769.0149 2.0581.1236 2.4261l9.8452 5.6841L24 9.0823V6.7275L' +
    '10.3248 14.623a.329.329 0 0 1-.3299 0L.1911 8.9628zm13.1698-1.9361c-.1819.1113-' +
    '.4394.0015-.4852-.2064l-.2805-1.1336-2.1254-.1752a.33.33 0 0 1-.1378-.6145l5.5782-' +
    '3.2207-1.7021-.9826L.6979 8.4935l9.462 5.463 13.5104-7.8004-4.401-2.5407-5.9084 ' +
    '3.4113zm-.1821-1.7286.2321.938 5.1984-3.0014-2.0395-1.1775-4.994 2.8834 1.3099' +
    '.108a.3302.3302 0 0 1 .2931.2495zM24 9.845l-13.6752 7.8954a.329.329 0 0 1-.3299 ' +
    '0L.1678 12.0667c-.3891.919.003 2.0914.1332 2.4311l9.8589 5.692L24 12.1993V9.845z"/>' +
    '</svg>';

  document.body.append(backdrop, curtain, toggle);

  /* ---- Open / close behaviour ---- */
  let lastFocus = null;

  function open() {
    lastFocus = document.activeElement;
    backdrop.hidden = false;
    // Force reflow so the transition runs from the hidden state.
    void curtain.offsetWidth;
    document.body.classList.add('curtain-open');
    curtain.classList.add('is-open');
    backdrop.classList.add('is-open');
    curtain.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    closeBtn.focus();
    document.addEventListener('keydown', onKeydown);
  }

  function close() {
    document.body.classList.remove('curtain-open');
    curtain.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    curtain.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKeydown);
    // Hide backdrop after the transition so it stops catching clicks.
    const hideBackdrop = () => { backdrop.hidden = true; };
    backdrop.addEventListener('transitionend', hideBackdrop, { once: true });
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  }

  toggle.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);

  // Tapping a reference chip jumps to its footnote inside the curtain — keep the
  // curtain open and scroll within it rather than navigating the whole page.
  curtain.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#ref-"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const target = curtain.querySelector('#' + CSS.escape(id));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
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

document.documentElement.lang = content.lang || 'en';
const host = buildMain(document.getElementById('page'));
buildCurtain();
mountConverter(host);
