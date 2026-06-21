// Engine A — Local (WebGPU/WASM), fully working (§4).
//
// Monocular depth (Depth Anything V2 Small, Apache-2.0 / commercial-safe) via
// the transformers.js depth-estimation pipeline, then a DIBR parallax warp to
// synthesize the stereo pair. Real model-load progress is surfaced through the
// `onProgress` callback (real bytes, not fake — §4.1).

import { localBackend } from './capabilities.js';
import { DibrWarper } from './dibr.js';

// Pinned, commercial-safe model (§12).
const MODEL_ID = 'onnx-community/depth-anything-v2-small';
// transformers.js is loaded from a CDN so the converter stays a buildless,
// static ES-module set (§0). esm.sh serves a proper ESM bundle.
const TRANSFORMERS_URL = 'https://esm.sh/@huggingface/transformers@3.5.1';

let _pipelinePromise = null;
let _backend = null;

/**
 * Lazily create (once) the depth-estimation pipeline.
 * @param {(p: object) => void} onProgress receives transformers.js progress
 */
async function getEstimator(onProgress) {
  if (_pipelinePromise) return _pipelinePromise;
  _backend = localBackend();
  _pipelinePromise = (async () => {
    const { pipeline, env } = await import(TRANSFORMERS_URL);
    // Allow remote model download; cache is handled by the browser / M3 SW.
    env.allowLocalModels = false;
    const estimator = await pipeline('depth-estimation', MODEL_ID, {
      device: _backend,
      dtype: 'fp16',
      progress_callback: (p) => onProgress?.(p),
    });
    return estimator;
  })();
  return _pipelinePromise;
}

export function activeBackend() {
  return _backend;
}

// transformers.js wants a RawImage / URL / canvas. An ImageBitmap is drawn to a
// canvas first so we control sizing and can reuse it for the warp.
function bitmapToCanvas(bitmap, maxSide = 1024) {
  let { width, height } = bitmap;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

// transformers.js depth output is a RawImage (grayscale). Convert to a canvas
// we can both display (depth PNG export, local-only) and feed to the warper.
function depthToCanvas(depth, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // RawImage exposes .data (Uint8), .width, .height, .channels.
  const dw = depth.width;
  const dh = depth.height;
  const ch = depth.channels || 1;
  const src = depth.data;
  const img = ctx.createImageData(dw, dh);
  for (let i = 0; i < dw * dh; i++) {
    const v = src[i * ch];
    img.data[i * 4 + 0] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  // Draw at native depth resolution, scaled to the colour image size.
  const tmp = document.createElement('canvas');
  tmp.width = dw;
  tmp.height = dh;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.drawImage(tmp, 0, 0, width, height);
  return canvas;
}

let _warper = null;
function warper() {
  if (!_warper) _warper = new DibrWarper();
  return _warper;
}

/**
 * Run the local engine.
 * @param {ImageBitmap} bitmap source photo
 * @param {object} opts { parallax, converge, invert, maxSide, onProgress }
 * @returns {Promise<{left:ImageBitmap,right:ImageBitmap,depth:ImageBitmap,depthCanvas:HTMLCanvasElement,colorCanvas:HTMLCanvasElement}>}
 */
export async function runLocal(bitmap, opts = {}) {
  const {
    parallax = 0.045,
    converge = 0.5,
    invert = false,
    maxSide = 1024,
    onProgress,
  } = opts;

  const estimator = await getEstimator(onProgress);
  const colorCanvas = bitmapToCanvas(bitmap, maxSide);
  const { width, height } = colorCanvas;

  // Depth Anything returns { depth: RawImage, predicted_depth: Tensor }.
  const out = await estimator(colorCanvas);
  const rawDepth = out.depth ?? out;
  const depthCanvas = depthToCanvas(rawDepth, width, height);

  const w = warper();
  const left = await w.render(colorCanvas, depthCanvas, {
    width, height, parallax, converge, invert, eyeSign: +1,
  });
  const right = await w.render(colorCanvas, depthCanvas, {
    width, height, parallax, converge, invert, eyeSign: -1,
  });
  const depth = await createImageBitmap(depthCanvas);

  return { left, right, depth, depthCanvas, colorCanvas };
}

export function disposeLocal() {
  _warper?.destroy();
  _warper = null;
}
