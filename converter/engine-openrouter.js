// Engine B — OpenRouter (AI), fully working (§5).
//
// An image-editing model synthesizes the second (right-eye) view and fills
// occlusions. Paid with the visitor's own credits via the PKCE key (§6).

import { getStoredKey } from './oauth.js';

const API = 'https://openrouter.ai/api/v1';
// Default to the top "best results" model (Nano Banana Pro).
export const DEFAULT_MODEL = 'google/gemini-3-pro-image';

// System prompt — the fixed "how to build a red/cyan anaglyph" instructions,
// sent as a `system` role message (a separate role from the user's input, per
// the OpenAI-compatible OpenRouter chat API). It describes, in detail, the same
// stereo pipeline this app performs in code (monocular depth -> DIBR horizontal
// parallax -> Dubois red/cyan compositing) so the model reproduces it inside.
export const ANAGLYPH_SYSTEM_PROMPT =
  'You are an expert stereographer. You convert a single 2D photograph into ' +
  'ONE finished red/cyan anaglyph 3D image, performing the entire stereoscopic ' +
  'pipeline internally. Work through these stages:\n\n' +

  '1) DEPTH ESTIMATION. Analyse the photo and build a per-pixel depth map from ' +
  'monocular depth cues: occlusion (what overlaps what), relative and known ' +
  'object size, linear perspective and vanishing lines, texture-density ' +
  'gradients, shading and cast shadows, atmospheric haze, and focus vs. blur. ' +
  'Decide what is near the camera and what is far — foreground subjects are ' +
  'near; sky, horizons and distant surfaces are far.\n\n' +

  '2) STEREO PARALLAX (two eyes). Synthesize a LEFT-eye and a RIGHT-eye view ' +
  'of the same scene, as if taken by two cameras separated by the human ' +
  'inter-ocular distance (~6.5 cm). This is purely HORIZONTAL parallax: shift ' +
  'each pixel sideways by an amount proportional to its nearness — near objects ' +
  'shift a lot between the two eyes, far objects barely shift, and the shift is ' +
  'in opposite directions for the two eyes. Never introduce any vertical shift. ' +
  'Place the convergence (zero-parallax) plane at roughly mid-depth: that plane ' +
  'stays aligned and sharp, objects in front of it appear to pop out toward the ' +
  'viewer, objects behind it recede into the screen. Keep the maximum ' +
  'displacement modest (a few percent of the image width) so it is comfortable ' +
  'to fuse. Where a shifted foreground edge reveals background that was hidden, ' +
  'plausibly in-paint that newly exposed sliver by extending the surrounding ' +
  'background.\n\n' +

  '3) ANAGLYPH ENCODING. Merge the two eye views into ONE image for red/cyan ' +
  '(red/blue) glasses. Put the LEFT-eye view into the RED channel and the ' +
  'RIGHT-eye view into the CYAN channels (green + blue), using Dubois-style ' +
  'colour mixing to minimise ghosting and retinal rivalry. The visible result ' +
  'is a normal-looking photograph carrying red/cyan colour fringes along depth ' +
  'edges — the wider the fringe offset, the closer that object reads.\n\n' +

  'OUTPUT RULES: return exactly ONE single image — the finished anaglyph — with ' +
  'the same scene, framing, aspect ratio and resolution as the input, filling ' +
  'the whole frame. Never output a grid, collage, contact sheet, film strip, ' +
  'split screen, side-by-side pair, raw depth map, border, caption or any text. ' +
  'By default apply moderate depth to the whole scene. If the user gives extra ' +
  'instructions, adjust the stereo accordingly (e.g. stronger or weaker overall ' +
  'depth, make only one specified object 3D while keeping the rest flat/2D, ' +
  'push particular elements further forward or back, or move the convergence ' +
  'plane).';

// Default user message when the user supplies no tuning instructions.
export const DEFAULT_USER_PROMPT =
  'Create the red/cyan 3D anaglyph of this image, following your instructions.';

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
 * finished red/cyan 3D anaglyph. The anaglyph algorithm is sent as a `system`
 * message; the user's optional tuning text is sent as the `user` message
 * alongside the source image.
 * @param {ImageBitmap} bitmap source photo
 * @param {object} opts { model, userPrompt }
 * @returns {Promise<{left:ImageBitmap,right:ImageBitmap}>}
 */
export async function runOpenRouter(bitmap, opts = {}) {
  const key = getStoredKey();
  if (!key) throw new Error('Not connected to OpenRouter. Connect first.');

  const model = opts.model || DEFAULT_MODEL;
  const userText = (opts.userPrompt || '').trim() || DEFAULT_USER_PROMPT;
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
          { role: 'system', content: ANAGLYPH_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: userText },
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
