// StereoConverter — public API (§0) + self-contained, brand-agnostic UI (§10).
//
// The converter knows nothing about branding, history, fonts or colours. It
// renders inside its host element using Shadow-DOM-scoped styles and reads
// optional CSS custom properties (--accent, --radius, …) the host may set.

import { Emitter } from './events.js';
import {
  hasWasm, hasWebGL2, hasWebCodecs, probeWebGPU, localBackend,
} from './capabilities.js';
import { runLocal, activeBackend, disposeLocal } from './engine-local.js';
import {
  runOpenRouter, listImageModels, DEFAULT_MODEL, ANAGLYPH_PROMPT,
} from './engine-openrouter.js';
import * as oauth from './oauth.js';
import { anaglyph, sideBySide, wiggleFrames } from './compositor.js';
import { canvasToPngBlob, encodeWiggle, download } from './exports.js';
import { CSS } from './styles.js';

export class StereoConverter {
  /**
   * @param {HTMLElement} host element to mount inside
   * @param {object} [options] { defaultEngine, openRouter:{callbackUrl} }
   */
  constructor(host, options = {}) {
    if (!host) throw new Error('StereoConverter requires a host element.');
    this.host = host;
    this.options = options;
    this._emitter = new Emitter();

    this._caps = {
      webgpu: false,
      wasm: hasWasm(),
      webgl2: hasWebGL2(),
      webcodecs: hasWebCodecs(),
      openRouterConnected: oauth.isConnected(),
      localBackend: localBackend(),
    };

    this._engine = options.defaultEngine || null; // resolved in ready()
    this._params = {
      parallax: 0.045,
      converge: 0.5,
      invert: false,
      wiggleAmplitude: 1.0,
      wiggleFps: 12,
      anaglyphMode: 'dubois',
    };
    this._sourceBitmap = null;
    this._lastResults = {}; // { local?, openrouter? } view bundles
    this._models = [];

    // AI prompt-mode state (OpenRouter engine only). Default: let the AI
    // generate the finished anaglyph itself, with no compositor step.
    this._aiPromptMode = 'anaglyph'; // anaglyph | stereo | edit-right | edit-3d | edit-only
    this._customPrompt = '';

    this._root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    this._readyPromise = this._init();
  }

  // ---- Public API --------------------------------------------------------

  ready() { return this._readyPromise; }

  getCapabilities() {
    return {
      webgpu: this._caps.webgpu,
      wasm: this._caps.wasm,
      openRouterConnected: this._caps.openRouterConnected,
      backend: this._caps.webgpu ? 'webgpu' : 'wasm',
      webcodecs: this._caps.webcodecs,
    };
  }

  on(type, fn) { return this._emitter.on(type, fn); }
  off(type, fn) { this._emitter.off(type, fn); }

  /**
   * Run a conversion with the given (or current) engine.
   * @param {ImageBitmap} bitmap
   * @param {object} [opts] { engine, ...params }
   * @returns {Promise<ConversionResult>}
   */
  async convert(bitmap, opts = {}) {
    await this.ready();
    const engine = opts.engine || this._engine;
    const params = { ...this._params, ...opts };
    const bundle = await this._runEngine(engine, bitmap, params);
    const result = this._toResult(bundle);
    this._emitter.emit('result', result);
    return result;
  }

  destroy() {
    disposeLocal();
    this._emitter.clear();
    if (this.host.shadowRoot) this._root.innerHTML = '';
    this._sourceBitmap = null;
    this._lastResults = {};
  }

  // ---- Init / capabilities ----------------------------------------------

  async _init() {
    // Complete any pending OpenRouter PKCE redirect before drawing UI (§6).
    try {
      const key = await oauth.handleRedirect();
      if (key) this._caps.openRouterConnected = true;
    } catch (err) {
      this._pendingAuthError = err.message;
    }

    this._caps.webgpu = await probeWebGPU();

    // On load: WebGPU present → default Local; else still default Local on
    // WASM while surfacing AI prominently in the toggle (§10).
    if (!this._engine) this._engine = 'local';

    this._caps.openRouterConnected = oauth.isConnected();
    this._render();
    if (this._pendingAuthError) this._status(this._pendingAuthError, true);
    this._emitter.emit('ready', this.getCapabilities());

    // Best-effort live model list when connected (§5.1); failure is non-fatal.
    if (this._caps.openRouterConnected) this._loadModels();
  }

  async _loadModels() {
    try {
      this._models = await listImageModels();
      this._renderModelOptions();
    } catch {
      /* keep pinned default */
    }
  }

  // ---- Engines -----------------------------------------------------------

  async _runEngine(engine, bitmap, params) {
    if (engine === 'openrouter') return this._runOpenRouterEngine(bitmap, params);
    return this._runLocalEngine(bitmap, params);
  }

  async _runLocalEngine(bitmap, params, label = 'Local') {
    this._status('Loading depth model…');
    const r = await runLocal(bitmap, {
      parallax: params.parallax,
      converge: params.converge,
      invert: params.invert,
      onProgress: (p) => this._onModelProgress(p),
    });
    this._caps.localBackend = activeBackend();
    return {
      engine: 'local',
      label,
      left: r.left,
      right: r.right,
      depth: r.depth,
      colorCanvas: r.colorCanvas,
      depthCanvas: r.depthCanvas,
      params,
    };
  }

  async _runOpenRouterEngine(bitmap, params) {
    const model = this._selectedModel || DEFAULT_MODEL;
    const mode = this._aiPromptMode || 'anaglyph';

    // Default: the AI generates the finished red/cyan anaglyph itself. Shown
    // as-is, with no compositor step.
    if (mode === 'anaglyph') {
      this._status('Generating 3D anaglyph with AI…');
      const { right: img } = await runOpenRouter(bitmap, { model, prompt: ANAGLYPH_PROMPT });
      return this._directBundle(img, 'AI 3D anaglyph', mode, params);
    }

    // Synthesize a right-eye view; the app builds the anaglyph (§5).
    if (mode === 'stereo') {
      this._status('Contacting OpenRouter…');
      const { left, right } = await runOpenRouter(bitmap, { model });
      return {
        engine: 'openrouter', label: 'AI (OpenRouter)', aiMode: mode,
        left, right, params,
      };
    }

    // Custom edit modes — the model rewrites the image from a free-text prompt.
    const prompt = (this._customPrompt || '').trim();
    if (!prompt) {
      throw new Error('Enter a custom prompt for this edit mode.');
    }
    this._status('Editing image with AI…');
    const { right: edited } = await runOpenRouter(bitmap, { model, prompt });

    if (mode === 'edit-only') {
      // Show just the edited image (no stereo pairing).
      return this._directBundle(edited, 'AI edit', mode, params);
    }
    if (mode === 'edit-right') {
      // Original = left, AI edit = right (difference-based pseudo-3D).
      return {
        engine: 'openrouter', label: 'AI edit → right view', aiMode: mode,
        left: bitmap, right: edited, edited, params,
      };
    }
    // edit-3d: feed the AI-edited image into the local depth+parallax pipeline
    // so a custom-edited painting still yields a real on-device 3D pair.
    this._status('Building depth from the edited image…');
    const bundle = await this._runLocalEngine(edited, params, 'AI edit → 3D');
    bundle.aiMode = mode;
    bundle.edited = edited;
    return bundle;
  }

  // A bundle whose AI image is the finished result, shown/downloaded as-is.
  _directBundle(img, label, mode, params) {
    return {
      engine: 'openrouter', label, aiMode: mode, direct: true,
      left: img, right: img, edited: img, params,
    };
  }

  _onModelProgress(p) {
    // transformers.js progress: { status, file, loaded, total, progress }
    this._emitter.emit('progress', p);
    if (p.status === 'progress' && p.total) {
      const pct = Math.round((p.loaded / p.total) * 100);
      this._setProgress(pct);
      this._status(`Downloading ${shortFile(p.file)} — ${pct}%`);
    } else if (p.status === 'ready' || p.status === 'done') {
      this._setProgress(100);
    }
  }

  // Build a ConversionResult (§2) with lazy export closures.
  _toResult(bundle) {
    const self = this;
    return {
      left: bundle.left,
      right: bundle.right,
      depth: bundle.depth,
      edited: bundle.edited, // present for AI custom-edit modes
      engine: bundle.engine,
      exports: {
        async anaglyph(mode) {
          return canvasToPngBlob(
            anaglyph(bundle.left, bundle.right, mode || self._params.anaglyphMode)
          );
        },
        async sideBySide() {
          return canvasToPngBlob(sideBySide(bundle.left, bundle.right));
        },
        async wiggle(opts = {}) {
          const frames = await wiggleFrames({
            left: bundle.left,
            right: bundle.right,
            colorCanvas: bundle.colorCanvas,
            depthCanvas: bundle.depthCanvas,
            parallax: bundle.params.parallax,
            converge: bundle.params.converge,
            invert: bundle.params.invert,
            amplitude: opts.amplitude ?? self._params.wiggleAmplitude,
            frames: opts.frames ?? 5,
          });
          const { blob } = await encodeWiggle(frames, {
            fps: opts.fps ?? self._params.wiggleFps,
            format: opts.format ?? 'auto',
          });
          return blob;
        },
        // depth PNG (local only, §2)
        depthPng: bundle.depthCanvas
          ? async () => canvasToPngBlob(bundle.depthCanvas)
          : undefined,
        // motionPhoto?(): added in M2 — intentionally absent in v1 (§2).
      },
    };
  }

  // ---- UI ----------------------------------------------------------------

  _render() {
    const style = document.createElement('style');
    style.textContent = CSS;

    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    wrap.innerHTML = `
      <div class="caps" id="caps"></div>

      <div class="engines" id="engines">
        <button class="toggle" data-engine="local">Local (on-device)</button>
        <button class="toggle" data-engine="openrouter">AI (OpenRouter)</button>
        <span class="spacer"></span>
        <button id="orBtn"></button>
      </div>

      <div id="orRow" class="ai-panel hidden">
        <div class="row">
          <label class="note" for="model">AI model:</label>
          <select id="model"></select>
          <a id="credits" href="https://openrouter.ai/credits" target="_blank" rel="noopener">Add credits ↗</a>
        </div>
        <div class="row">
          <label class="note" for="promptMode">Mode:</label>
          <select id="promptMode">
            <option value="anaglyph">3D anaglyph — AI generates it (red/cyan)</option>
            <option value="stereo">Stereo right-eye view (app builds anaglyph)</option>
            <option value="edit-3d">Custom edit → then make 3D (local depth)</option>
            <option value="edit-right">Custom edit → right view (3D-ish)</option>
            <option value="edit-only">Custom edit → edited image only</option>
          </select>
        </div>
        <textarea id="customPrompt" class="prompt hidden" rows="3"
          placeholder="Describe the edit, e.g. 'Restore this painting: repair cracks, recover the faded colours, keep the composition and brushwork identical.'"></textarea>
        <div class="note">Custom edits run on the AI engine; the model rewrites the image from your instructions.</div>
      </div>

      <label class="drop" id="drop">
        <input type="file" id="file" accept="image/*" />
        <div><b>Choose a photo</b> or drop it here</div>
        <div class="note">A single existing image is converted to a 3D stereo pair.</div>
      </label>

      <div class="controls" id="controls">
        ${rangeRow('parallax', 'Depth strength', 0, 0.12, 0.005, this._params.parallax)}
        ${rangeRow('converge', 'Convergence', 0, 1, 0.02, this._params.converge)}
        ${rangeRow('wiggleAmplitude', 'Wiggle amp.', 0.2, 1.5, 0.05, this._params.wiggleAmplitude)}
        ${rangeRow('wiggleFps', 'Wiggle fps', 6, 24, 1, this._params.wiggleFps)}
        <div class="control">
          <label for="invert">Invert depth</label>
          <input type="checkbox" id="invert" />
          <output></output>
        </div>
        <div class="control">
          <label for="anaglyphMode">Anaglyph</label>
          <select id="anaglyphMode">
            <option value="dubois">Dubois (default)</option>
            <option value="half-color">Half-colour (LCD-friendly)</option>
            <option value="color">Plain colour</option>
            <option value="gray">Grayscale</option>
          </select>
          <output></output>
        </div>
      </div>

      <div class="row">
        <button class="primary" id="convert" disabled>Convert</button>
        <button id="rotate" disabled>Rotate 90°</button>
        <button id="convertBoth" class="hidden">Compare Local vs AI</button>
        <span class="spacer"></span>
        <div class="progress hidden" id="progressWrap"><i id="progress"></i></div>
      </div>

      <div class="status" id="status"></div>

      <div class="views hidden" id="views"></div>
    `;

    this._root.innerHTML = '';
    this._root.append(style, wrap);
    this._cacheEls();
    this._wireEvents();
    this._renderCaps();
    this._renderEngineToggle();
    this._renderOrButton();
    this._renderModelOptions();
  }

  _cacheEls() {
    const $ = (id) => this._root.getElementById(id);
    this.$ = {
      caps: $('caps'),
      engines: $('engines'),
      orBtn: $('orBtn'),
      orRow: $('orRow'),
      model: $('model'),
      promptMode: $('promptMode'),
      customPrompt: $('customPrompt'),
      drop: $('drop'),
      file: $('file'),
      convert: $('convert'),
      rotate: $('rotate'),
      convertBoth: $('convertBoth'),
      progress: $('progress'),
      progressWrap: $('progressWrap'),
      status: $('status'),
      views: $('views'),
      invert: $('invert'),
      anaglyphMode: $('anaglyphMode'),
    };
  }

  _wireEvents() {
    const { drop, file, convert, convertBoth, orBtn, model } = this.$;

    file.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (f) this._loadFile(f);
    });
    drop.addEventListener('dragover', (e) => {
      e.preventDefault();
      drop.classList.add('hover');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('hover'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('hover');
      const f = e.dataTransfer.files?.[0];
      if (f) this._loadFile(f);
    });

    this._root.querySelectorAll('[data-engine]').forEach((b) => {
      b.addEventListener('click', () => {
        this._engine = b.dataset.engine;
        this._renderEngineToggle();
      });
    });

    convert.addEventListener('click', () => this._doConvert());
    convertBoth.addEventListener('click', () => this._doCompare());
    this.$.rotate.addEventListener('click', () => this._rotateSource());

    orBtn.addEventListener('click', () => this._toggleOpenRouter());
    model?.addEventListener('change', () => {
      this._selectedModel = model.value;
    });

    // AI prompt mode + custom prompt (OpenRouter engine).
    this.$.promptMode.addEventListener('change', () => {
      this._aiPromptMode = this.$.promptMode.value;
      // The custom prompt box is only relevant to the edit-* modes.
      const needsPrompt = this._aiPromptMode.startsWith('edit');
      this.$.customPrompt.classList.toggle('hidden', !needsPrompt);
      // Every prompt mode is AI-only; switch to the AI engine for convenience.
      if (this._caps.openRouterConnected) {
        this._engine = 'openrouter';
        this._renderEngineToggle();
      }
    });
    this.$.customPrompt.addEventListener('input', () => {
      this._customPrompt = this.$.customPrompt.value;
    });

    // Parameter sliders (§11 M3 controls).
    this._root.querySelectorAll('input[type=range]').forEach((r) => {
      r.addEventListener('input', () => {
        const key = r.dataset.key;
        const step = parseFloat(r.step) || 0;
        const val = parseFloat(r.value);
        this._params[key] = step >= 1 ? Math.round(val) : val;
        r.parentElement.querySelector('output').textContent = fmtVal(val, step);
      });
    });
    this.$.invert.addEventListener('change', () => {
      this._params.invert = this.$.invert.checked;
    });
    this.$.anaglyphMode.addEventListener('change', () => {
      this._params.anaglyphMode = this.$.anaglyphMode.value;
      this._refreshAnaglyphs();
    });
  }

  _renderCaps() {
    const c = this._caps;
    const local = c.webgpu
      ? '<b class="ok">WebGPU ✓</b>'
      : (c.wasm ? '<b>WASM</b>' : '<b class="no">unavailable</b>');
    const ai = c.openRouterConnected
      ? '<b class="ok">connected ✓</b>'
      : '<b class="no">connect</b>';
    this.$.caps.innerHTML =
      `<span>Local: ${local}</span>` +
      `<span>AI: ${ai}</span>` +
      `<span>Wiggle: <b>${c.webcodecs ? 'MP4' : 'GIF'}</b></span>`;
  }

  _renderEngineToggle() {
    this._root.querySelectorAll('[data-engine]').forEach((b) => {
      b.classList.toggle('active', b.dataset.engine === this._engine);
    });
    // Show "Compare" only when both engines are usable.
    const canBoth = this._caps.openRouterConnected;
    this.$.convertBoth.classList.toggle('hidden', !canBoth || !this._sourceBitmap);
  }

  _renderOrButton() {
    const connected = this._caps.openRouterConnected;
    this.$.orBtn.textContent = connected ? 'Disconnect AI' : 'Connect OpenRouter';
    this.$.orRow.classList.toggle('hidden', !connected);
  }

  _renderModelOptions() {
    const sel = this.$?.model;
    if (!sel) return;
    const opts = [{ id: DEFAULT_MODEL, name: 'Gemini 2.5 Flash Image (default)' }];
    for (const m of this._models) {
      if (m.id !== DEFAULT_MODEL) opts.push(m);
    }
    sel.innerHTML = opts
      .map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`)
      .join('');
    sel.value = this._selectedModel || DEFAULT_MODEL;
  }

  async _toggleOpenRouter() {
    if (oauth.isConnected()) {
      oauth.disconnect();
      this._caps.openRouterConnected = false;
      this._renderCaps();
      this._renderOrButton();
      this._renderEngineToggle();
      this._status('Disconnected from OpenRouter.');
    } else {
      this._status('Redirecting to OpenRouter…');
      const cb = this.options.openRouter?.callbackUrl;
      await oauth.startLogin(cb);
    }
  }

  async _loadFile(file) {
    try {
      this._status('Reading image…');
      // Honour EXIF orientation so portrait phone photos load upright.
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      this._sourceBitmap = bitmap;
      this.$.convert.disabled = false;
      this.$.rotate.disabled = false;
      this._renderEngineToggle();
      this._status(`Loaded ${file.name} (${bitmap.width}×${bitmap.height}).`);
      this._showSource(bitmap);
    } catch (err) {
      this._status(`Could not read image: ${err.message}`, true);
    }
  }

  // Rotate the source 90° clockwise (the whole pipeline depends on
  // orientation, so we rotate the input, not the output). Re-converts
  // automatically if a result is already on screen.
  async _rotateSource() {
    if (!this._sourceBitmap) return;
    const hadResult = !!this._currentBundle ||
      !!this.$.views.querySelector('.compare');
    const wasCompare = !!this.$.views.querySelector('.compare');
    this._sourceBitmap = await rotateBitmap90(this._sourceBitmap);
    this._lastResults = {};
    this._currentBundle = null;
    this._showSource(this._sourceBitmap);
    if (hadResult) {
      if (wasCompare) await this._doCompare();
      else await this._doConvert();
    } else {
      this._status('Rotated 90°.');
    }
  }

  _showSource(bitmap) {
    this.$.views.classList.remove('hidden');
    this.$.views.innerHTML = '';
    const v = viewerEl('Source', canvasFromBitmap(bitmap));
    this.$.views.append(v);
  }

  async _doConvert() {
    if (!this._sourceBitmap) return;
    this._busy(true);
    try {
      const bundle = await this._runEngine(
        this._engine, this._sourceBitmap, this._params
      );
      this._lastResults[this._engine] = bundle;
      this._renderResult(bundle);
      this._emitter.emit('result', this._toResult(bundle));
      this._status('Done.');
    } catch (err) {
      this._status(err.message, true);
      this._emitter.emit('error', err);
    } finally {
      this._busy(false);
    }
  }

  // A-vs-B: AI synthesis is geometrically unstable, so always also compute the
  // local result and let the user keep the better one (§5.3).
  async _doCompare() {
    if (!this._sourceBitmap) return;
    this._busy(true);
    try {
      this._status('Computing Local result…');
      const local = await this._runEngine('local', this._sourceBitmap, this._params);
      this._lastResults.local = local;
      this._status('Computing AI result…');
      const ai = await this._runEngine('openrouter', this._sourceBitmap, this._params);
      this._lastResults.openrouter = ai;
      this._renderCompare(local, ai);
      this._status('Compare ready — keep whichever looks better.');
    } catch (err) {
      this._status(err.message, true);
      this._emitter.emit('error', err);
    } finally {
      this._busy(false);
    }
  }

  _renderResult(bundle) {
    this.$.views.classList.remove('hidden');
    this.$.views.innerHTML = '';
    const card = this._buildResultCard(bundle, `Result — ${bundle.label || bundle.engine}`);
    this.$.views.append(card);
    this._currentBundle = bundle;
  }

  _renderCompare(local, ai) {
    this.$.views.classList.remove('hidden');
    this.$.views.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'compare';
    grid.append(
      this._buildResultCard(local, 'A — Local (DIBR)', true),
      this._buildResultCard(ai, 'B — AI (OpenRouter)', true)
    );
    this.$.views.append(grid);
  }

  _buildResultCard(bundle, title, compact = false) {
    const card = document.createElement('div');
    card.className = compact ? 'card' : 'viewer';

    const h = document.createElement('h4');
    h.textContent = title;
    card.append(h);

    // Direct AI image (anaglyph / edited): show it as-is with a PNG download,
    // no compositor step.
    if (bundle.direct) {
      const cv = canvasFromBitmap(bundle.edited);
      cv.className = 'out';
      card.append(cv);
      const ex = document.createElement('div');
      ex.className = 'exports';
      ex.append(btn('Download PNG', () => this._exportEdited(bundle)));
      card.append(ex);
      return card;
    }

    // Default preview = anaglyph (the headline fused output).
    const ana = anaglyph(bundle.left, bundle.right, this._params.anaglyphMode);
    ana.className = 'out';
    ana.dataset.role = 'anaglyph';
    card.append(ana);

    const exports = document.createElement('div');
    exports.className = 'exports';
    exports.append(
      btn('Anaglyph PNG', () => this._exportAnaglyph(bundle)),
      btn('Side-by-side PNG', () => this._exportSBS(bundle)),
      btn('Wiggle ' + (this._caps.webcodecs ? 'MP4' : 'GIF'), () => this._exportWiggle(bundle)),
    );
    if (bundle.depthCanvas) {
      exports.append(btn('Depth PNG', () => this._exportDepth(bundle)));
    }
    if (bundle.edited) {
      exports.append(btn('Edited PNG', () => this._exportEdited(bundle)));
    }
    card.append(exports);

    // The AI-instability caveat only applies when the geometry comes from the
    // AI itself (stereo / edit→right), not when local depth built it (edit-3d).
    if (bundle.engine === 'openrouter' &&
        (bundle.aiMode === 'stereo' || bundle.aiMode === 'edit-right')) {
      const note = document.createElement('div');
      note.className = 'note';
      note.textContent =
        'AI viewpoint synthesis can be geometrically unstable — compare with Local.';
      card.append(note);
    }
    return card;
  }

  // Re-render the visible result(s) so a changed anaglyph mode takes effect.
  _refreshAnaglyphs() {
    if (this._lastResults.local && this._lastResults.openrouter &&
        this.$.views.querySelector('.compare')) {
      this._renderCompare(this._lastResults.local, this._lastResults.openrouter);
    } else if (this._currentBundle) {
      this._renderResult(this._currentBundle);
    }
  }

  async _exportAnaglyph(bundle) {
    await this._withBusy('Encoding anaglyph…', async () => {
      const blob = await canvasToPngBlob(
        anaglyph(bundle.left, bundle.right, this._params.anaglyphMode));
      download(blob, `stereo-anaglyph-${bundle.engine}.png`);
    });
  }

  async _exportSBS(bundle) {
    await this._withBusy('Encoding side-by-side…', async () => {
      const blob = await canvasToPngBlob(sideBySide(bundle.left, bundle.right));
      download(blob, `stereo-sbs-${bundle.engine}.png`);
    });
  }

  async _exportDepth(bundle) {
    await this._withBusy('Encoding depth…', async () => {
      const blob = await canvasToPngBlob(bundle.depthCanvas);
      download(blob, `stereo-depth-${bundle.engine}.png`);
    });
  }

  async _exportEdited(bundle) {
    await this._withBusy('Encoding image…', async () => {
      const blob = await canvasToPngBlob(canvasFromBitmap(bundle.edited));
      const name = bundle.aiMode === 'anaglyph' ? 'ai-anaglyph.png' : 'ai-edited.png';
      download(blob, name);
    });
  }

  async _exportWiggle(bundle) {
    await this._withBusy('Rendering wiggle…', async () => {
      const frames = await wiggleFrames({
        left: bundle.left,
        right: bundle.right,
        colorCanvas: bundle.colorCanvas,
        depthCanvas: bundle.depthCanvas,
        parallax: this._params.parallax,
        converge: this._params.converge,
        invert: this._params.invert,
        amplitude: this._params.wiggleAmplitude,
        frames: 5,
      });
      const { blob, format } = await encodeWiggle(frames, {
        fps: this._params.wiggleFps,
        format: 'auto',
      });
      download(blob, `stereo-wiggle-${bundle.engine}.${format}`);
    });
  }

  // ---- small helpers -----------------------------------------------------

  async _withBusy(msg, fn) {
    this._busy(true);
    this._status(msg);
    try {
      await fn();
      this._status('Saved.');
    } catch (err) {
      this._status(err.message, true);
      this._emitter.emit('error', err);
    } finally {
      this._busy(false);
    }
  }

  _busy(on) {
    this.$.convert.disabled = on || !this._sourceBitmap;
    this.$.rotate.disabled = on || !this._sourceBitmap;
    this.$.convertBoth.disabled = on;
    this.$.progressWrap.classList.toggle('hidden', !on);
    if (!on) this._setProgress(0);
  }

  _setProgress(pct) {
    this.$.progress.style.width = `${pct}%`;
  }

  _status(msg, isError = false) {
    if (!this.$?.status) return;
    this.$.status.textContent = msg || '';
    this.$.status.classList.toggle('error', !!isError);
  }
}

// ---- module-local DOM helpers --------------------------------------------

function fmtVal(value, step) {
  return step >= 1 ? String(Math.round(value)) : value.toFixed(3);
}

function rangeRow(key, label, min, max, step, value) {
  return `
    <div class="control">
      <label for="${key}">${label}</label>
      <input type="range" id="${key}" data-key="${key}"
        min="${min}" max="${max}" step="${step}" value="${value}" />
      <output>${fmtVal(value, step)}</output>
    </div>`;
}

function btn(label, onClick) {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function viewerEl(title, canvas) {
  const v = document.createElement('div');
  v.className = 'viewer';
  const h = document.createElement('h4');
  h.textContent = title;
  canvas.className = 'out';
  v.append(h, canvas);
  return v;
}

async function rotateBitmap90(bitmap) {
  const c = document.createElement('canvas');
  c.width = bitmap.height;
  c.height = bitmap.width;
  const ctx = c.getContext('2d');
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  return createImageBitmap(c);
}

function canvasFromBitmap(bitmap) {
  const c = document.createElement('canvas');
  c.width = bitmap.width;
  c.height = bitmap.height;
  c.getContext('2d').drawImage(bitmap, 0, 0);
  return c;
}

function shortFile(f) {
  if (!f) return 'model';
  const parts = String(f).split('/');
  return parts[parts.length - 1];
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export default StereoConverter;
