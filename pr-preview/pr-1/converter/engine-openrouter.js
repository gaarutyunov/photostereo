// Engine B — OpenRouter (AI), fully working (§5).
//
// An image-editing model synthesizes the second (right-eye) view and fills
// occlusions. Paid with the visitor's own credits via the PKCE key (§6).

import { getStoredKey } from './oauth.js';

const API = 'https://openrouter.ai/api/v1';
export const DEFAULT_MODEL = 'google/gemini-2.5-flash-image';

// The model always produces a finished red/cyan 3D anaglyph. These are the
// fixed "system" instructions; an optional user edit is prepended by
// buildAnaglyphPrompt() so the scene is edited before the anaglyph is made.
export const ANAGLYPH_PROMPT =
  'Turn this photo into ONE single finished red/cyan anaglyph 3D image — the ' +
  'classic stereoscopic picture viewed with red/cyan (red/blue) 3D glasses. ' +
  'Create realistic horizontal stereo parallax from the scene depth: encode ' +
  'the left-eye view in the RED channel and the right-eye view in the CYAN ' +
  '(green+blue) channels, so foreground objects show a clear red/cyan colour ' +
  'fringe at their edges while distant areas stay aligned. Keep the same ' +
  'scene, framing, aspect ratio and resolution as the input and fill the whole ' +
  'frame. Output exactly one image — never a grid, collage, contact sheet, ' +
  'film strip, split screen, side-by-side pair, border or text.';

/**
 * Build the full prompt: an optional user edit applied first, then the fixed
 * anaglyph instructions. With no edit, it's just the anaglyph instructions.
 * @param {string} [edit] user's optional edit instruction
 */
export function buildAnaglyphPrompt(edit) {
  const e = (edit || '').trim();
  if (!e) return ANAGLYPH_PROMPT;
  return (
    'First, edit the photo as follows, applying the change to the whole scene: ' +
    `${e}\n\nThen, using that edited scene, ${ANAGLYPH_PROMPT[0].toLowerCase()}` +
    ANAGLYPH_PROMPT.slice(1)
  );
}

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
 * Run the OpenRouter engine end-to-end (§5.2). The model always returns a
 * finished 3D anaglyph image (with the original as `left` for the public API).
 * @param {ImageBitmap} bitmap source photo
 * @param {object} opts { model, prompt }  prompt defaults to ANAGLYPH_PROMPT
 * @returns {Promise<{left:ImageBitmap,right:ImageBitmap}>}
 */
export async function runOpenRouter(bitmap, opts = {}) {
  const key = getStoredKey();
  if (!key) throw new Error('Not connected to OpenRouter. Connect first.');

  const model = opts.model || DEFAULT_MODEL;
  const prompt = opts.prompt || ANAGLYPH_PROMPT;
  const dataUrl = await bitmapToDataURL(bitmap);

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

  const aiImage = await dataURLtoBitmap(url);
  // Models occasionally return a different size/aspect (or, when prompted
  // poorly, a collage). Force the result to the source dimensions so the
  // stereo pair is aligned and compositing never letterboxes.
  const right = await fitToSize(aiImage, bitmap.width, bitmap.height);
  const left = bitmap; // original becomes the left view (§5.2)
  return { left, right };
}

async function dataURLtoBitmap(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

async function fitToSize(bitmap, width, height) {
  if (bitmap.width === width && bitmap.height === height) return bitmap;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  return createImageBitmap(canvas);
}
