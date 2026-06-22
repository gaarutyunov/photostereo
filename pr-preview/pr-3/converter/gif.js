// Minimal, dependency-free animated GIF89a encoder (LZW + median-cut palette).
// Used only as the wiggle fallback when WebCodecs/H.264 is unavailable (§7).

// ---- Median-cut quantization to a global palette (<=256 colours) ----------

function buildPalette(frames, maxColors = 256) {
  // Sample pixels across all frames to bound work on large images.
  const samples = [];
  const stride = Math.max(1, Math.floor(
    (frames[0].data.length / 4) * frames.length / 20000
  ));
  for (const f of frames) {
    const d = f.data;
    for (let i = 0; i < d.length; i += 4 * stride) {
      samples.push([d[i], d[i + 1], d[i + 2]]);
    }
  }

  let boxes = [{ pixels: samples }];
  while (boxes.length < maxColors) {
    // Split the box with the largest colour range.
    let best = -1, bestRange = -1, bestChan = 0;
    for (let b = 0; b < boxes.length; b++) {
      const px = boxes[b].pixels;
      if (px.length < 2) continue;
      const min = [255, 255, 255], max = [0, 0, 0];
      for (const p of px) {
        for (let c = 0; c < 3; c++) {
          if (p[c] < min[c]) min[c] = p[c];
          if (p[c] > max[c]) max[c] = p[c];
        }
      }
      for (let c = 0; c < 3; c++) {
        const r = max[c] - min[c];
        if (r > bestRange) { bestRange = r; best = b; bestChan = c; }
      }
    }
    if (best < 0 || bestRange <= 0) break;
    const box = boxes[best];
    box.pixels.sort((a, b) => a[bestChan] - b[bestChan]);
    const mid = box.pixels.length >> 1;
    const left = { pixels: box.pixels.slice(0, mid) };
    const right = { pixels: box.pixels.slice(mid) };
    boxes.splice(best, 1, left, right);
  }

  const palette = boxes.map((b) => {
    const px = b.pixels;
    const sum = [0, 0, 0];
    for (const p of px) { sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2]; }
    const n = Math.max(1, px.length);
    return [Math.round(sum[0] / n), Math.round(sum[1] / n), Math.round(sum[2] / n)];
  });
  while (palette.length < 2) palette.push([0, 0, 0]);
  return palette;
}

function nearest(palette, r, g, b, cache) {
  const key = (r >> 3 << 10) | (g >> 3 << 5) | (b >> 3);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let bi = 0, bd = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const p = palette[i];
    const dr = r - p[0], dg = g - p[1], db = b - p[2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bd) { bd = d; bi = i; }
  }
  cache.set(key, bi);
  return bi;
}

// ---- Byte writer ----------------------------------------------------------

class ByteWriter {
  constructor() { this.bytes = []; }
  byte(b) { this.bytes.push(b & 0xff); }
  bytes2(a, b) { this.byte(a); this.byte(b); }
  word(w) { this.byte(w & 0xff); this.byte((w >> 8) & 0xff); }
  str(s) { for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i)); }
  toUint8() { return new Uint8Array(this.bytes); }
}

// ---- LZW (GIF variant) ----------------------------------------------------

function lzwEncode(minCodeSize, indices) {
  const out = [];
  let cur = 0, curBits = 0;
  const block = [];
  const flushByte = (b) => {
    block.push(b);
    if (block.length === 255) { out.push(255, ...block); block.length = 0; }
  };
  const emit = (code, bits) => {
    cur |= code << curBits;
    curBits += bits;
    while (curBits >= 8) { flushByte(cur & 0xff); cur >>= 8; curBits -= 8; }
  };

  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let dict = new Map();
  const resetDict = () => {
    dict = new Map();
    for (let i = 0; i < clear; i++) dict.set(String(i), i);
  };
  let next = eoi + 1;
  resetDict();
  emit(clear, codeSize);

  let prefix = String(indices[0]);
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const combined = prefix + ',' + k;
    if (dict.has(combined)) {
      prefix = combined;
    } else {
      emit(dict.get(prefix), codeSize);
      dict.set(combined, next++);
      if (next > (1 << codeSize) && codeSize < 12) codeSize++;
      if (next >= 4096) { emit(clear, codeSize); resetDict(); next = eoi + 1; codeSize = minCodeSize + 1; }
      prefix = String(k);
    }
  }
  emit(dict.get(prefix), codeSize);
  emit(eoi, codeSize);
  if (curBits > 0) flushByte(cur & 0xff);
  if (block.length) out.push(block.length, ...block);
  out.push(0); // block terminator
  return out;
}

// ---- Public encode --------------------------------------------------------

/**
 * @param {ImageData[]} frames equal-sized frames
 * @param {object} opts { delay (ms), loop (0=forever) }
 * @returns {Blob} image/gif
 */
export function encodeGIF(frames, opts = {}) {
  const delay = Math.round((opts.delay ?? 100) / 10); // in 1/100s
  const loop = opts.loop ?? 0;
  const w = frames[0].width, h = frames[0].height;
  const palette = buildPalette(frames, 256);

  // Palette must be a power-of-two size for the GIF colour table.
  let bits = 1;
  while ((1 << bits) < palette.length) bits++;
  const tableSize = 1 << bits;

  const wr = new ByteWriter();
  wr.str('GIF89a');
  wr.word(w); wr.word(h);
  // Global colour table flag, colour resolution, sort flag, table size.
  wr.byte(0x80 | ((bits - 1) << 4) | (bits - 1));
  wr.byte(0); // background colour index
  wr.byte(0); // pixel aspect ratio
  for (let i = 0; i < tableSize; i++) {
    const p = palette[i] || [0, 0, 0];
    wr.byte(p[0]); wr.byte(p[1]); wr.byte(p[2]);
  }

  // NETSCAPE2.0 looping extension.
  wr.byte(0x21); wr.byte(0xff); wr.byte(11);
  wr.str('NETSCAPE2.0');
  wr.byte(3); wr.byte(1); wr.word(loop); wr.byte(0);

  const cache = new Map();
  const minCode = Math.max(2, bits);
  for (const f of frames) {
    // Graphic control extension (delay).
    wr.byte(0x21); wr.byte(0xf9); wr.byte(4);
    wr.byte(0); // no transparency, no disposal
    wr.word(delay);
    wr.byte(0); wr.byte(0);

    // Image descriptor.
    wr.byte(0x2c);
    wr.word(0); wr.word(0); wr.word(w); wr.word(h);
    wr.byte(0); // no local colour table

    // Indices.
    const d = f.data;
    const indices = new Uint8Array(w * h);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      indices[p] = nearest(palette, d[i], d[i + 1], d[i + 2], cache);
    }

    wr.byte(minCode);
    const lzw = lzwEncode(minCode, indices);
    for (const b of lzw) wr.byte(b);
  }

  wr.byte(0x3b); // trailer
  return new Blob([wr.toUint8()], { type: 'image/gif' });
}
