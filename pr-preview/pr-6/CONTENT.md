# Stereoscope Landing Page — Content & Theming Specification v1

> **Companion to** `stereoscope-app-spec-v1.md` (the converter build spec).
> **Hard boundary:** nothing in this document may require changes inside `/converter/**`. The landing page *mounts* the converter through its public API (§0 of the build spec) and styles only its container. If a content or theming idea here seems to need a converter code change, it is out of scope and must be renegotiated against the build spec — never patched into the converter.

## 1. Purpose

This page is the public face for lectures and expositions at the **Museo Ruso de Málaga**. It does two jobs:

1. Present the **history and science of stereoscopy** as readable, well-referenced public content (lecture companion).
1. Host the **converter** as one interactive section, so visitors can try turning their own photos into 3D.

It must be reusable for future lectures/expositions: the content sections are data-driven (editable without touching the converter), and theming is CSS-only.

## 2. Isolation rules (the part that protects the build)

- The converter is included as `import { StereoConverter } from './converter/index.js'` and mounted into a host element. The page never reaches inside it.
- Theming reaches the converter **only** through documented CSS custom properties (e.g. `--accent`, `--radius`, `--font`). No overriding of converter-internal selectors.
- All history/content lives in a separate content source (a `content.js`/JSON file or Markdown), so editing copy for a new exhibition never risks the app.
- Page-level libraries (fonts, analytics, scroll animations) must not introduce global CSS or JS that leaks into the converter’s scoped styles/Shadow DOM.
- Build/deploy is shared (same GitHub Pages site), but the converter is a static module set that the page links to — they ship together yet stay decoupled.

## 3. Page structure (content-driven)

1. **Hero** — exhibition/lecture title, one-line hook, CTA scrolling to the converter.
1. **The converter** — mounted `StereoConverter`; brief instructions; example before/after.
1. **History & science** — the narrative sections in §4, each editable as a content entry.
1. **About this lecture / credits** — speaker, museum, date, references.
1. **Footer** — references list, licensing, links.

Each section is a content object: `{ id, title, body (markdown), media[], references[] }`. Adding a future lecture = adding/editing content entries + swapping the theme, with zero converter changes.

## 4. History & science content (lecture companion, referenced)

> Editorial note: present the Queen-Victoria/Great-Exhibition popularization as the traditional, widely-repeated account (it rests largely on Brewster’s own telling); what’s independently documented is her later purchase from Claudet (1852). Flag a few technical figures (Stereokino screen specs; NIKFI award date/wording) for a primary-source check before print.

- **The discovery of stereopsis & the first stereoscope.** Charles Wheatstone’s 1838 Royal Society paper on binocular vision; the mirror (reflecting) stereoscope; predates photography; binocular disparity as the brain’s depth cue. (June 21 = informal “Stereoscopy Day.”)
- **Brewster & the Great Exhibition (1849–1851).** Brewster’s lenticular (lens/prism) handheld stereoscope; Duboscq builds it in Paris; shown at the 1851 Crystal Palace; the popularization narrative and its caveat; “No home without a stereoscope.”
- **Holmes & the stereograph craze (1859→).** Oliver Wendell Holmes’s cheap open viewer, deliberately unpatented; standardized stereo cards (~7 cm pair spacing ≈ eye spacing); the first mass photographic medium; Victorian “VR.”
- **The anaglyph (1853 / 1891).** Rollmann’s red/blue line method (Stargard, 1853); D’Almeida’s projection (1858); Ducos du Hauron’s printed photographic anaglyphs (1891); modern red/cyan; tradeoffs — ghosting and retinal rivalry, fixed by the Dubois matrix in the app.
- **Polarized 3D & the View-Master (1939).** Land/Polaroid polarizers preserve full color; 1939 polarized films; the 1939 View-Master and its WWII training use; lineage toward modern cinema/VR 3D.
- **Glasses-free depth: parallax & the wigglegram.** Motion parallax as a depth cue; wiggle stereoscopy alternates L/R views — no glasses, works on any screen, even for one-eyed viewers; can’t be printed; this is what the app’s wiggle export delivers.
- **Live Photos / Motion Photos as wiggle 3D.** Still + short motion clip (Apple Live Photo = JPEG/HEIC + ~3 s MOV tied by asset id; Google Motion Photo = JPEG/HEIC with embedded MP4 via XMP); a synthesized parallax sweep is exactly such a clip — the app exports a Google Motion Photo as the closest “Live Photo-like” artifact.
- **How human depth perception works.** Binocular disparity + convergence; average adult IPD ≈ 63 mm (50–75 mm); content authored for ~63–65 mm; this is why the synthesized “second eye” corresponds to a small, IPD-scale lateral shift — and why the AI prompt says “~6 cm to the right.”
- **Russian/Soviet stereo cinema (Museo Ruso tie-in).** Semyon Ivanov’s parallax-barrier glasses-free system (Stalin Prize 1941); Moscow’s “Stereokino” theatre, public opening 4 Feb 1941 with *Zemlya molodosti*; *Robinzon Kruzo* (1947) as an early glasses-free feature; NIKFI’s **Stereo 70** and its Academy Sci/Tech recognition. A strong thematic anchor for a Russian-museum exhibition.

(Full citations/links are carried in the research dossier the converter spec was derived from; the footer references list should reproduce them.)

## 5. Theming

- **Mechanism:** CSS custom properties at `:root`, plus a small theme file per exhibition (`theme-<name>.css`). Switching exhibitions = swapping one CSS file.
- **Tokens (suggested):** `--accent`, `--accent-contrast`, `--bg`, `--fg`, `--muted`, `--radius`, `--font-display`, `--font-body`, `--max-width`.
- **Converter tinting:** pass `--accent` / `--radius` through to the converter host; that’s the only styling coupling permitted.
- **Museo Ruso default theme:** restrained, exhibition-appropriate; legible long-form typography for the history sections; the converter visually integrated but functionally independent.
- **Accessibility:** WCAG AA contrast; respects `prefers-reduced-motion` (pause the wiggle/auto-animations); keyboard-navigable.

## 6. Content workflow for future lectures

1. Duplicate the content file; edit titles/body/media/references.
1. Add a `theme-<name>.css` (or reuse the default).
1. Open a PR → automatic preview URL (per the build spec’s PR-preview workflow) to review content + theme on a real device.
1. Merge → deployed to GitHub Pages. **Converter code untouched throughout.**

## 7. Out of scope here

- Any converter functionality (engines, depth, DIBR, anaglyph, wiggle, exports, OAuth, camera) — see the build spec.
- Anything requiring edits inside `/converter/**`.