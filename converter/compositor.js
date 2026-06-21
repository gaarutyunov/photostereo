// Compositor (§7 / §2 exports): Dubois anaglyph, side-by-side, wiggle frames.
// Produces canvases/ImageData; encoding to Blobs lives in exports.js.

import { DibrWarper } from './dibr.js';

function toCanvas(src) {
  if (src instanceof HTMLCanvasElement) return src;
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

function imageData(src) {
  const c = toCanvas(src);
  return c.getContext('2d').getImageData(0, 0, c.width, c.height);
}

// Return image data for `src` scaled to exactly w×h (anaglyph requires the two
// views to share dimensions; the AI engine's output may not match).
function imageDataAt(src, w, h) {
  if ((src.width === w && src.height === h)) return imageData(src);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').drawImage(src, 0, 0, w, h);
  return c.getContext('2d').getImageData(0, 0, w, h);
}

// Dubois red/cyan matrices (CRT-calibrated default, §12). Linear-ish RGB.
// L contributes mostly to the red channel, R to green+blue.
const DUBOIS_L = [
  0.4561, 0.500484, 0.176381,
  -0.0400822, -0.0378246, -0.0157589,
  -0.0152161, -0.0205971, -0.00546856,
];
const DUBOIS_R = [
  -0.0434706, -0.0879388, -0.00155529,
  0.378476, 0.73364, -0.0184503,
  -0.0721527, -0.112961, 1.2264,
];

function clamp8(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * Anaglyph compositing (§2). Modes: 'dubois' (default), 'color' (plain),
 * 'half-color', 'gray'.
 * @returns {HTMLCanvasElement}
 */
export function anaglyph(left, right, mode = 'dubois') {
  const L = imageData(left);
  const w = L.width, h = L.height;
  const R = imageDataAt(toCanvas(right), w, h); // ensure matching dimensions
  const out = new ImageData(w, h);
  const a = L.data, b = R.data, o = out.data;

  for (let i = 0; i < a.length; i += 4) {
    const lr = a[i], lg = a[i + 1], lb = a[i + 2];
    const rr = b[i], rg = b[i + 1], rb = b[i + 2];
    if (mode === 'dubois') {
      o[i] = clamp8(
        DUBOIS_L[0] * lr + DUBOIS_L[1] * lg + DUBOIS_L[2] * lb +
        DUBOIS_R[0] * rr + DUBOIS_R[1] * rg + DUBOIS_R[2] * rb);
      o[i + 1] = clamp8(
        DUBOIS_L[3] * lr + DUBOIS_L[4] * lg + DUBOIS_L[5] * lb +
        DUBOIS_R[3] * rr + DUBOIS_R[4] * rg + DUBOIS_R[5] * rb);
      o[i + 2] = clamp8(
        DUBOIS_L[6] * lr + DUBOIS_L[7] * lg + DUBOIS_L[8] * lb +
        DUBOIS_R[6] * rr + DUBOIS_R[7] * rg + DUBOIS_R[8] * rb);
    } else if (mode === 'gray') {
      const lgray = 0.299 * lr + 0.587 * lg + 0.114 * lb;
      const rgray = 0.299 * rr + 0.587 * rg + 0.114 * rb;
      o[i] = lgray; o[i + 1] = rgray; o[i + 2] = rgray;
    } else if (mode === 'half-color') {
      const lgray = 0.299 * lr + 0.587 * lg + 0.114 * lb;
      o[i] = lgray; o[i + 1] = rg; o[i + 2] = rb;
    } else { // 'color' (plain)
      o[i] = lr; o[i + 1] = rg; o[i + 2] = rb;
    }
    o[i + 3] = 255;
  }

  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').putImageData(out, 0, 0);
  return c;
}

/** Side-by-side pair, left | right (§2). */
export function sideBySide(left, right) {
  const lc = toCanvas(left);
  const rc = toCanvas(right);
  const h = Math.max(lc.height, rc.height);
  const c = document.createElement('canvas');
  c.width = lc.width + rc.width;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(lc, 0, 0);
  ctx.drawImage(rc, lc.width, 0);
  return c;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Wiggle frames (§7): 3–5 viewpoints, ease-in-out loop, modest amplitude.
 * If a depth+colour canvas pair is supplied (local engine), true intermediate
 * viewpoints are rendered via DIBR. Otherwise (OpenRouter) the two supplied
 * views are blended along the eased path — a classic two-pose wigglegram.
 *
 * @param {object} args { left, right, colorCanvas?, depthCanvas?, parallax?,
 *                        converge?, invert?, frames?, amplitude? }
 * @returns {Promise<HTMLCanvasElement[]>} ping-pong loop of frames
 */
export async function wiggleFrames(args) {
  const {
    left, right,
    colorCanvas, depthCanvas,
    parallax = 0.05, converge = 0.5, invert = false,
    frames = 5, amplitude = 1.0,
  } = args;

  const lc = toCanvas(left);
  const w = lc.width, h = lc.height;
  const out = [];

  if (colorCanvas && depthCanvas) {
    const warper = new DibrWarper();
    try {
      for (let k = 0; k < frames; k++) {
        const t = easeInOut(frames === 1 ? 0.5 : k / (frames - 1));
        // Map t∈[0,1] to eyeSign-scaled parallax around convergence.
        const eye = (t - 0.5) * 2 * amplitude; // -amp..+amp
        const bmp = await warper.render(colorCanvas, depthCanvas, {
          width: w, height: h, parallax, converge, invert,
          eyeSign: eye,
        });
        out.push(toCanvas(bmp));
      }
    } finally {
      warper.destroy();
    }
  } else {
    const rc = toCanvas(right);
    for (let k = 0; k < frames; k++) {
      const t = easeInOut(frames === 1 ? 0.5 : k / (frames - 1));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(lc, 0, 0);
      ctx.globalAlpha = t; // cross-blend left->right
      ctx.drawImage(rc, 0, 0, w, h);
      ctx.globalAlpha = 1;
      out.push(c);
    }
  }

  // Ping-pong so the loop is seamless (forward then back, no dup endpoints).
  const back = out.slice(1, -1).reverse();
  return out.concat(back);
}
