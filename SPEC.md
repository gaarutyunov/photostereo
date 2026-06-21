# Stereoscope Converter — Build Specification v2

> **Scope of this document:** the functional photo→stereo converter only. History/lecture content, branding, and theming are deliberately **out of scope** and live in a separate document (`stereoscope-landing-content-spec.md`). See §0 for the isolation contract that keeps those concerns from ever touching this implementation.

## 0. Isolation contract (why this spec is self-contained)

The converter is built as a **self-contained, brand-agnostic module** with a defined public API. It knows nothing about the Museo Ruso, the lecture, copy, fonts, or colors. The landing page is a separate layer that *mounts* the converter and styles its container from the outside.

- **Public API (stable):**
  
  ```js
  import { StereoConverter } from './converter/index.js';
  const c = new StereoConverter(hostElement, {
    defaultEngine: 'local' | 'openrouter',
    openRouter: { callbackUrl },      // optional
  });
  await c.ready();                    // resolves when capabilities are known
  c.getCapabilities();                // { webgpu, wasm, openRouterConnected }
  c.on('result', (out) => { ... });   // out = ConversionResult (see §2)
  c.convert(imageBitmap, opts);       // returns Promise<ConversionResult>
  c.destroy();
  ```
- **Styling boundary:** the converter renders inside its host element using its own scoped styles (Shadow DOM or a scoped class prefix). The landing page may size/position the host and set CSS custom properties the converter reads (`--accent`, `--radius`, etc.), but **cannot** alter converter internals.
- **No shared global state, no shared build step required.** The converter ships as a static ES module set; the landing page is plain HTML that imports it. Theming or content changes can never break conversion because they live in different files behind the API.
- **Hard rule:** nothing in the landing-content spec may require edits inside `/converter/**`.

-----

## 1. Goal & scope

A fully client-side converter that turns **a single existing photo** into stereoscopic output, hostable on GitHub Pages with no backend. Two **fully-working, interchangeable engines ship together in v1** (no stubs, no “coming later”):

- **Engine A — Local (WebGPU/WASM):** monocular depth + DIBR parallax warp. Free, offline, no account.
- **Engine B — OpenRouter (AI):** image-editing model synthesizes/refines the second view and fills occlusions, paid with the visitor’s own credits via OAuth PKCE.

Both engines are real and complete at first release, because device WebGPU support is uncertain and OpenRouter must be a genuine alternative from day one.

### Primary flow (the polished path)

**Choose an existing image → convert → view & export.**

### Secondary flow (added later, also fully working when it lands)

Capture one photo from the browser camera, then feed the same pipeline. Single frame only — never two-photo stereo capture.

### Non-goals

- Two-photo physical stereo capture.
- True Apple Live Photo / MV-HEVC spatial export — not achievable in-browser (§7).
- Any server, database, or shared/developer API key.
- Branding, history content, theming (separate spec).

-----

## 2. The conversion contract (shared by both engines)

Both engines produce the **same** result object, so everything downstream is engine-agnostic:

```ts
type ConversionResult = {
  left: ImageBitmap;
  right: ImageBitmap;
  depth?: ImageBitmap;        // present for local engine
  engine: 'local' | 'openrouter';
  exports: {
    anaglyph(mode?): Promise<Blob>;       // Dubois default; plain/gray/half-color
    sideBySide(): Promise<Blob>;
    wiggle(opts?): Promise<Blob>;         // MP4 (primary) / GIF (fallback)
    motionPhoto?(): Promise<Blob>;        // added in M2
  };
};
```

Outputs available in v1: **anaglyph** (red/cyan glasses), **wiggle MP4/GIF** (naked eye), **side-by-side** PNG, and **depth map** PNG (local only). Motion Photo export and camera capture arrive in M2 — each fully working when it does.

-----

## 3. Architecture

```
┌──────────── Converter module (static ES modules, GitHub Pages) ────────────┐
│  StereoConverter (public API, §0)                                          │
│        │                                                                   │
│   Image source ── existing image (v1) | camera (M2) ──► ImageBitmap        │
│        │                                                                   │
│   Engine selector  ─────────────┬───────────────────────┐                 │
│        ▼                         ▼                        ▼                 │
│  Engine A (Local)          Engine B (OpenRouter)    capability/fallback    │
│  depth (transformers.js)   PKCE key ► chat/completions  logic              │
│  + DIBR warp (WebGPU/WebGL) modalities:[image,text]                        │
│        └──────────► { left, right, depth? }  ◄──────────┘                  │
│                          │                                                 │
│   Compositor: Dubois anaglyph · wiggle frames · SBS · (Motion Photo M2)    │
│                          │                                                 │
│                    Export / download / share                              │
└────────────────────────────────────────────────────────────────────────────┘
        ▲ mounted by, never coupled to ▼
┌──────────── Landing page (separate spec: content + theming) ───────────────┐
└────────────────────────────────────────────────────────────────────────────┘
```

-----

## 4. Engine A — Local (WebGPU/WASM) — fully working in v1

### 4.1 Depth estimation

- Model: `onnx-community/depth-anything-v2-small` (fp16 ONNX, ~50 MB, **Apache-2.0**, commercial-safe).
- Runtime: `@huggingface/transformers` `depth-estimation` pipeline.
- Device: detect `navigator.gpu`; use `webgpu`, else `wasm`. Active backend exposed via `getCapabilities()`.
- Load progress surfaced through a `progress` event (real bytes, not fake).

```js
const backend = ('gpu' in navigator) ? 'webgpu' : 'wasm';
const estimator = await pipeline('depth-estimation',
  'onnx-community/depth-anything-v2-small',
  { device: backend, dtype: 'fp16' });
const { depth } = await estimator(rawImage);
```

### 4.2 DIBR parallax warp

- Normalize depth to `[0,1]` (near = white; invert if needed).
- Synthesize L/R by horizontal displacement `Δx = parallax·(d − c)`, applied as `±Δx/2` to fix the convergence plane `c` at screen depth.
- Implementation: full-screen-quad fragment shader, WebGL2 by default, WGSL/WebGPU when available; render twice to two framebuffers.
- Disocclusion: asymmetric-Gaussian depth pre-smoothing + horizontal background-stretch crack-fill. Keep displacement modest; large holes are handled by Engine B or accepted as mild artifacts.

**v1 acceptance (must pass, not stubbed):** an arbitrary uploaded photo yields a correct stereo pair, a fused anaglyph, and a looping wiggle, on both a WebGPU device (your iPhone 13 Pro Max, iOS 26.5) and a WASM-only fallback device; depth+warp < ~3 s on a mid-range 2023 phone.

-----

## 5. Engine B — OpenRouter (AI) — fully working in v1

### 5.1 Model

- Default: `google/gemini-2.5-flash-image` (“Nano Banana”), image editing, ~$0.04/image.
- Live model list: `GET /api/v1/models?output_modalities=image` populates an advanced dropdown; default stays pinned.

### 5.2 Request/response (real, end-to-end)

```js
POST https://openrouter.ai/api/v1/chat/completions
Authorization: Bearer <userKey>
{ model:'google/gemini-2.5-flash-image', modalities:['image','text'],
  messages:[{ role:'user', content:[
    { type:'text', text: SECOND_VIEW_PROMPT },
    { type:'image_url', image_url:{ url:'data:image/jpeg;base64,...' } } ]}] }
```

Returned image: `choices[0].message.images[0].image_url.url` (base64 data URL) → decoded to the `right` ImageBitmap; original becomes `left`.

### 5.3 Default second-view prompt

> “Generate the exact same scene, subject, lighting, colors and style as the input image, but captured from a camera viewpoint shifted ~6 cm to the right (small horizontal parallax, as if seen by the right eye). Keep every object identical; reveal and naturally fill small background areas newly visible behind foreground edges. Identical proportions, exposure, white balance, focus. Photorealistic, no warping.”

Also exposes a **hole-fill mode** (send DIBR right-view + “inpaint revealed background to match”). Both modes are real in v1. Because AI viewpoint synthesis is geometrically unstable, the converter always also computes the local result and offers an **A-vs-B comparison** so the user keeps the better one.

-----

## 6. OpenRouter OAuth (PKCE) — fully working in v1

No shared key; the key lives only in the visitor’s browser.

1. Web Crypto: generate `code_verifier` + S256 `code_challenge`; store verifier in `sessionStorage`.
1. Redirect: `https://openrouter.ai/auth?callback_url=<PAGES_URL>&code_challenge=<C>&code_challenge_method=S256`.
1. On return: POST `{ code, code_verifier, code_challenge_method:'S256' }` → `/api/v1/auth/keys`; receive `key`.
1. Store key in `localStorage`; send as `Authorization: Bearer`. “Disconnect” clears it.

Callback = the GitHub Pages URL (HTTPS). Handle 400/403/405 with clear messages. Connection state + “add credits” link surfaced via the public API.

-----

## 7. Wiggle & Motion Photo output

- **Wiggle (v1):** 3–5 viewpoints, ease-in-out loop, modest amplitude. MP4 via WebCodecs `VideoEncoder` (H.264); GIF fallback when WebCodecs/HEVC unavailable. Headline glasses-free deliverable.
- **Google Motion Photo (M2):** mux the wiggle MP4 into a JPEG with `GCamera` XMP; opens as a motion photo in Google Photos. Closest “Live Photo-like” artifact.
- **Apple Live Photo / MV-HEVC spatial: OUT OF SCOPE** — no browser API encodes multiview HEVC. Surfaced in-UI as a known limitation.

-----

## 8. Camera capture (M2, fully working when shipped)

`getUserMedia({ video:{ facingMode:{ ideal:'environment' } }, audio:false })` → draw frame to canvas → same pipeline. `<video autoplay playsinline muted>`. Handle `NotAllowedError`/`NotFoundError`. HTTPS satisfied by Pages. Single frame only.

-----

## 9. Deployment

- **Production:** `actions/upload-pages-artifact` + `actions/deploy-pages` from `main` (OIDC, `github-pages` environment).
- **PR previews:** `rossjrw/pr-preview-action` → `gh-pages` under `pr-preview/pr-<N>/`, `clean-exclude: pr-preview/`.
- CORS: OpenRouter permits direct browser calls — no proxy.
- Both workflows must be live and green from M1.

-----

## 10. UX requirements (converter only)

- Engine toggle always visible with live readout from `getCapabilities()`: “Local: WebGPU ✓ / WASM” and “AI: connected ✓ / connect”.
- On load: WebGPU present → default Local; else surface AI prominently while still offering WASM.
- A-vs-B comparison whenever both results exist.
- Real model-load progress, real error/empty states (no placeholders).
- All UI scoped inside the converter host; no global styles. Reads optional CSS custom properties for accent/radius so the landing page can tint it without code changes.

-----

## 11. Milestones — each ships complete, working functionality

> Principle: **vertical slices, never stubs.** Every milestone is independently usable end-to-end.

- **M1 — Core converter, both engines, existing-image flow.**
  Upload an existing photo → pick Local *or* OpenRouter (both fully functional, PKCE complete) → real stereo pair → **anaglyph + wiggle MP4/GIF + side-by-side** exports → A-vs-B compare. WebGPU/WASM detection live. Deployed to Pages with working PR previews. *This is a complete, shippable product with no stubbed paths.*
- **M2 — Secondary I/O (each fully working).** Browser camera capture; Google Motion Photo export.
- **M3 — Robustness & control (each fully working).** Model-weight caching via Cache API/service worker; parameter sliders (depth strength, convergence, wiggle amplitude/speed, anaglyph mode); comprehensive error/recovery states; perf tuning.

**Definition of done (v1 = M1):** an arbitrary existing photo converts to a 3D wiggle MP4 and a red/cyan anaglyph via *either* fully-working engine, on a phone and a desktop, hosted on GitHub Pages with PR previews — neither WebGPU nor an OpenRouter account strictly required, and **no stubbed or placeholder functionality anywhere in the shipped path.**

-----

## 12. Decisions locked

- Depth model = Depth Anything V2 **Small** (Apache-2.0). Base/Large are CC-BY-NC → excluded.
- Both engines fully implemented in v1; DIBR always computed as anchor/fallback for the AI path.
- Apple spatial export excluded by platform limits → Motion Photo substitute (M2).
- Dubois anaglyph default (CRT-calibrated); LCD-tuned variant + plain toggle offered.
- Converter is brand/content-agnostic; history & theming cannot modify `/converter/**` (§0).