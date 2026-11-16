// Draws the favicon, Home Screen icons and the share-preview image with the
// game's own pixel renderer, then writes them as PNGs into icons/.
// Run with `npm run icons` after changing the art; the PNGs are committed.

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import { Pix, PAL } from '../src/render/pixel.js';
import { POSES, makeTransform, drawFigure, drawBoard } from '../src/render/stickman.js';

const OUT = new URL('../icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

// A stand-in for a 2D canvas context: Pix only needs createImageData().
const fakeCtx = { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) };

// Encode RGBA pixels as a PNG, scaling each pixel up to `k` x `k`.
function png(g, k = 1) {
  const W = g.w * k;
  const H = g.h * k;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    const row = y * (W * 4 + 1);
    raw[row] = 0; // no filter
    for (let x = 0; x < W; x++) {
      const s = (Math.floor(y / k) * g.w + Math.floor(x / k)) * 4;
      for (let c = 0; c < 4; c++) raw[row + 1 + x * 4 + c] = g.data[s + c];
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// An .ico file that wraps one PNG (supported by every current browser).
function ico(pngBuf, size) {
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2); // icon
  head.writeUInt16LE(1, 4); // one image
  head[6] = size;
  head[7] = size;
  head.writeUInt16LE(1, 10); // colour planes
  head.writeUInt16LE(32, 12); // bits per pixel
  head.writeUInt32LE(pngBuf.length, 14);
  head.writeUInt32LE(22, 18);
  return Buffer.concat([head, pngBuf]);
}

const save = (name, buf) => writeFileSync(new URL(name, OUT), buf);

// The rider mid-kickflip: feet at (fx, fy) in pixels, `s` pixels per world unit.
function rider(g, fx, fy, s) {
  drawFigure(g, makeTransform(fx / s, fy / s, 0, s), POSES.flip);
  // board under the feet, nose tipped up, rotated around its own middle
  drawBoard(g, makeTransform(fx / s, fy / s - 22, -0.3, s), 0, 0);
}

// Draws text mirrored left-to-right (as if seen in a mirror), centred on x.
function mirroredText(g, str, x, y, c, scale) {
  const flipped = { textWidth: g.textWidth, fill: (fx, fy, w, h, col) => g.fill(2 * x - fx - w, fy, w, h, col) };
  Pix.prototype.text.call(flipped, str, x, y, c, scale, 'center');
}

// Square icon on an N x N grid: "STICK" stacked over a mirrored "FLIP", in red
// with a black drop shadow, over a strip of black ground. `k` is the letter
// scale. Maskable icons get cropped to a circle by Android, so they keep the
// lettering inside the middle 80%.
function icon(N, k) {
  const g = new Pix(fakeCtx, N, N);
  g.clear(PAL.sky);
  const ground = N - Math.max(3, Math.round(N * 0.14));
  g.fill(0, ground, N, N - ground, PAL.ink);
  const gap = Math.max(2, k * 2);
  const blockH = 14 * k + gap;
  const top = Math.round((ground - blockH) / 2);
  const cx = N / 2;
  const y2 = top + 7 * k + gap;
  g.text('STICK', cx + 1, top + 1, PAL.ink, k, 'center');
  g.text('STICK', cx, top, PAL.red, k, 'center');
  mirroredText(g, 'FLIP', cx + 1, y2 + 1, PAL.ink, k);
  mirroredText(g, 'FLIP', cx, y2, PAL.red, k);
  return g;
}

// Favicon: drawn at its real size so the pixels stay crisp in a browser tab.
const fav32 = png(icon(32, 1));
save('favicon-32.png', fav32);
writeFileSync(new URL('../favicon.ico', import.meta.url), ico(fav32, 32));

// Home Screen icons: small pixel drawings scaled up by whole numbers.
// The lettering spans about two thirds of the width, so rounded corners and
// Android's circle crop never clip it.
save('apple-touch-icon.png', png(icon(90, 2), 2)); // 180 x 180
save('icon-192.png', png(icon(96, 2), 2));
save('icon-512.png', png(icon(128, 3), 4));
save('icon-maskable-512.png', png(icon(128, 3), 4));

// Share preview, 1200 x 630: a 240 x 126 scene scaled by 5.
{
  const W = 240;
  const H = 126;
  const g = new Pix(fakeCtx, W, H);
  g.clear(PAL.sky);
  const ground = 104;
  g.fill(0, ground, W, H - ground, PAL.ink);
  // a rail like level 1's
  const [x1, x2, top] = [124, 214, ground - 18];
  for (const px of [x1 + 7, x2 - 7]) {
    g.line(px, top + 2, px, ground - 1, PAL.ink);
    g.line(px - 2, ground - 1, px + 2, ground - 1, PAL.ink);
  }
  g.line(x1, top, x2, top, PAL.ink);
  g.line(x1, top + 1, x2, top + 1, PAL.ink);
  rider(g, 76, ground - 12, 1 / 3);
  g.text('STICKFLIP', W / 2 + 1, 9, PAL.ink, 4, 'center');
  g.text('STICKFLIP', W / 2, 8, PAL.red, 4, 'center');
  g.text('TAP TO OLLIE. SWIPE TO FLIP.', W / 2, 41, PAL.red, 1, 'center');
  g.text('PLAY IN YOUR BROWSER', W / 2, 113, PAL.red, 1, 'center');
  save('og-image.png', png(g, 5));
}

console.log('icons written to icons/ and favicon.ico');
