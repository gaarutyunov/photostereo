# Stereoscope Converter

A fully client-side converter that turns **a single existing photo** into
stereoscopic output — hostable on GitHub Pages with no backend. See
[`SPEC.md`](./SPEC.md) for the full build specification.

Two interchangeable engines ship together:

- **Local (WebGPU/WASM)** — monocular depth (Depth Anything V2 Small,
  Apache-2.0) + DIBR parallax warp. Free, offline, no account.
- **OpenRouter (AI)** — an image-editing model synthesizes the second view and
  fills occlusions, paid with the visitor's own credits via OAuth PKCE.

### AI engine behaviour

The **AI engine** always produces a finished red/cyan **3D anaglyph**, shown and
downloaded exactly as the model returns it (no compositor step). The request
uses two distinct chat roles (OpenRouter is OpenAI-compatible):

- A **system** message (`ANAGLYPH_SYSTEM_PROMPT`) carries the full anaglyph
  algorithm — monocular depth estimation → horizontal stereo parallax (DIBR) →
  Dubois red/cyan encoding — i.e. the same pipeline this app runs in code, so the
  model reproduces it internally.
- A **user** message carries the source image plus your **optional** tuning
  instructions. These don't just edit the scene — they steer *how* the 3D is
  built:
  - **Blank** → a standard 3D anaglyph.
  - *"Make the depth stronger"*, *"Only make the person pop out, keep the
    background flat 2D"*, *"Push the foreground further forward"*, or a scene
    edit — the model adjusts depth strength, which objects are 3D, convergence,
    etc.

The compositor (anaglyph/side-by-side/wiggle fusion) is only used by the
**Local** engine, which is purely geometric depth + parallax and has no text
input.

Output: a red/cyan **anaglyph** PNG (download). When OpenRouter is connected, the
converter also computes the local result and offers an **A-vs-B comparison** so
you keep the better one.

## Run locally

The converter is a buildless set of static ES modules (`/converter/**`). Serve
the repository root over HTTP (modules and WebGPU require a server, not
`file://`):

```bash
python3 -m http.server 8000
# open http://localhost:8000/
```

OpenRouter OAuth requires an HTTPS callback (satisfied by GitHub Pages in
production).

## Architecture

The converter is a **self-contained, brand-agnostic module** with a stable
public API (§0). The landing page (`index.html`) merely *mounts* it and tints
it from the outside via CSS custom properties (`--accent`, `--radius`); it never
edits anything under `/converter/**`.

```js
import { StereoConverter } from './converter/index.js';

const c = new StereoConverter(hostElement, { defaultEngine: 'local' });
await c.ready();
c.getCapabilities();              // { webgpu, wasm, openRouterConnected, ... }
c.on('result', (out) => { ... }); // ConversionResult (see SPEC §2)
await c.convert(imageBitmap, { engine: 'local' });
c.destroy();
```

### Module layout

| File | Responsibility |
| --- | --- |
| `converter/index.js` | Public API + scoped Shadow-DOM UI |
| `converter/engine-local.js` | Depth estimation (transformers.js) |
| `converter/dibr.js` | WebGL2 DIBR parallax warp |
| `converter/engine-openrouter.js` | OpenRouter chat/completions image edit |
| `converter/oauth.js` | OpenRouter OAuth PKCE flow |
| `converter/compositor.js` | Anaglyph (Dubois), side-by-side, wiggle frames |
| `converter/exports.js` | PNG, MP4 (WebCodecs + mp4-muxer), GIF |
| `converter/gif.js` | Dependency-free animated GIF encoder (fallback) |
| `converter/capabilities.js` | WebGPU/WASM/WebCodecs/WebGL2 detection |

## Deployment

- **Production:** `actions/deploy-pages` from `main` (`.github/workflows/deploy.yml`).
- **PR previews:** `rossjrw/pr-preview-action` → `gh-pages` under
  `pr-preview/pr-<N>/` (`.github/workflows/pr-preview.yml`).

To enable: in the repo's **Settings → Pages**, set **Source** to *GitHub
Actions*.

## Scope

This repository implements the converter (SPEC milestone **M1**). Camera
capture and Google Motion Photo export are **M2**; model-weight caching and
extended controls are **M3**. Apple Live Photo / MV-HEVC spatial export is not
achievable in-browser and is out of scope. Branding, history and theming live
in a separate spec and cannot modify `/converter/**`.
