// Engine B — OpenRouter (AI), fully working (§5).
//
// An image-editing model synthesizes the second (right-eye) view and fills
// occlusions. Paid with the visitor's own credits via the PKCE key (§6).

import { getStoredKey } from './oauth.js';

const API = 'https://openrouter.ai/api/v1';
export const DEFAULT_MODEL = 'google/gemini-2.5-flash-image';

// §5.3 — default second-view prompt.
export const SECOND_VIEW_PROMPT =
  'Generate the exact same scene, subject, lighting, colors and style as the ' +
  'input image, but captured from a camera viewpoint shifted ~6 cm to the ' +
  'right (small horizontal parallax, as if seen by the right eye). Keep every ' +
  'object identical; reveal and naturally fill small background areas newly ' +
  'visible behind foreground edges. Identical proportions, exposure, white ' +
  'balance, focus. Photorealistic, no warping.';

// §5.3 — hole-fill mode: refine a DIBR-warped right view by inpainting.
export const HOLE_FILL_PROMPT =
  'This is a right-eye stereo view warped from a left image; some background ' +
  'areas behind foreground edges are stretched or missing. Inpaint the ' +
  'revealed background to match the surrounding scene exactly. Do not move or ' +
  'reshape any object. Keep proportions, exposure, white balance and focus ' +
  'identical. Photorealistic, no warping.';

async function bitmapToDataURL(bitmap, type = 'image/jpeg', quality = 0.92) {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  const blob = await new Promise((r) => canvas.toBlob(r, type, quality));
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('Failed to encode image.'));
    fr.readAsDataURL(blob);
  });
}

/**
 * Live model list (§5.1) — image-output models for an advanced dropdown.
 * Default stays pinned regardless of what this returns.
 */
export async function listImageModels() {
  const res = await fetch(`${API}/models?output_modalities=image`);
  if (!res.ok) throw new Error(`Model list failed (HTTP ${res.status}).`);
  const data = await res.json();
  return (data.data || []).map((m) => ({ id: m.id, name: m.name || m.id }));
}

/**
 * Run the OpenRouter engine end-to-end (§5.2).
 * @param {ImageBitmap} bitmap source photo (becomes the left view)
 * @param {object} opts { model, prompt, rightSeed }
 *   rightSeed: optional ImageBitmap (DIBR right view) for hole-fill mode.
 * @returns {Promise<{left:ImageBitmap,right:ImageBitmap}>}
 */
export async function runOpenRouter(bitmap, opts = {}) {
  const key = getStoredKey();
  if (!key) throw new Error('Not connected to OpenRouter. Connect first.');

  const model = opts.model || DEFAULT_MODEL;
  const isHoleFill = !!opts.rightSeed;
  const prompt = opts.prompt || (isHoleFill ? HOLE_FILL_PROMPT : SECOND_VIEW_PROMPT);
  const sourceForAI = isHoleFill ? opts.rightSeed : bitmap;
  const dataUrl = await bitmapToDataURL(sourceForAI);

  let res;
  try {
    res = await fetch(`${API}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': location.origin,
        'X-Title': 'Stereoscope Converter',
      },
      body: JSON.stringify({
        model,
        modalities: ['image', 'text'],
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    throw new Error(`Network error contacting OpenRouter: ${err.message}`);
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error('OpenRouter rejected the key. Reconnect your account.');
  }
  if (res.status === 402) {
    throw new Error('Out of OpenRouter credits. Add credits and try again.');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenRouter error (HTTP ${res.status}). ${text}`.trim());
  }

  const data = await res.json();
  const msg = data?.choices?.[0]?.message;
  const url = msg?.images?.[0]?.image_url?.url;
  if (!url) {
    throw new Error('OpenRouter returned no image. Try the Local engine or retry.');
  }

  const right = await dataURLtoBitmap(url);
  const left = bitmap; // original becomes the left view (§5.2)
  return { left, right };
}

async function dataURLtoBitmap(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return createImageBitmap(blob);
}
