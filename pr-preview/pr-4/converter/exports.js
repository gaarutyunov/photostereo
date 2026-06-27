// Export encoders (§2 exports, §7 wiggle).
// PNG via canvas; wiggle MP4 via WebCodecs VideoEncoder (H.264) muxed with
// mp4-muxer; GIF fallback via the bundled encoder when WebCodecs is absent.

import { hasWebCodecs } from './capabilities.js';
import { encodeGIF } from './gif.js';

const MUXER_URL = 'https://esm.sh/mp4-muxer@5.1.5';

export function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('PNG encode failed.'))),
      'image/png'
    );
  });
}

function frameToImageData(canvas) {
  return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Encode wiggle frames to a looping clip.
 * @param {HTMLCanvasElement[]} frames
 * @param {object} opts { fps, format: 'mp4'|'gif'|'auto', loops }
 * @returns {Promise<{blob: Blob, format: 'mp4'|'gif'}>}
 */
export async function encodeWiggle(frames, opts = {}) {
  const fps = opts.fps ?? 12;
  const format = opts.format ?? 'auto';
  const wantMp4 = format === 'mp4' || (format === 'auto' && hasWebCodecs());

  if (wantMp4) {
    try {
      const blob = await encodeMP4(frames, fps);
      return { blob, format: 'mp4' };
    } catch (err) {
      if (format === 'mp4') throw err;
      // fall through to GIF on any WebCodecs/muxer failure
      console.warn('[StereoConverter] MP4 encode failed, using GIF:', err);
    }
  }

  const imageDatas = frames.map(frameToImageData);
  const blob = encodeGIF(imageDatas, { delay: 1000 / fps, loop: 0 });
  return { blob, format: 'gif' };
}

async function encodeMP4(frames, fps) {
  if (!hasWebCodecs()) throw new Error('WebCodecs unavailable.');
  const { Muxer, ArrayBufferTarget } = await import(MUXER_URL);

  // H.264 needs even dimensions.
  const w = frames[0].width - (frames[0].width % 2);
  const h = frames[0].height - (frames[0].height % 2);

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: w, height: h, frameRate: fps },
    fastStart: 'in-memory',
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { throw e; },
  });

  // Try a widely-supported H.264 profile/level (baseline 3.1).
  encoder.configure({
    codec: 'avc1.42001f',
    width: w,
    height: h,
    bitrate: 4_000_000,
    framerate: fps,
  });

  const usPerFrame = 1_000_000 / fps;
  for (let i = 0; i < frames.length; i++) {
    const vf = new VideoFrame(frames[i], {
      timestamp: Math.round(i * usPerFrame),
      duration: Math.round(usPerFrame),
    });
    encoder.encode(vf, { keyFrame: i === 0 });
    vf.close();
  }

  await encoder.flush();
  encoder.close();
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}

/** Trigger a browser download for a Blob. */
export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
