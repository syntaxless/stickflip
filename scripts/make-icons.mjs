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

// The rider mid-trick: feet at (fx, fy) in pixels, `s` pixels per world unit,
// tilted by `ang` radians (- = nose up).
function rider(g, fx, fy, s, ang = 0, pose = POSES.flip) {
  drawFigure(g, makeTransform(fx / s, fy / s, ang, s), pose);
  // board under the feet, nose tipped up, rotated around its own middle
  drawBoard(g, makeTransform(fx / s, fy / s - 22, ang - 0.3, s), 0, 0);
}

// Square icon on an N x N grid, matching the start screen: "STICK" stacked over
// "FLIP" in the red title font with a black drop shadow, centred on plain navy.
// `k` is the letter scale. The lettering spans about two thirds of the width,
// so rounded corners and Android's circle crop never clip it.
function icon(N, k) {
  const g = new Pix(fakeCtx, N, N);
  g.clear(PAL.sky);
  const gap = Math.max(2, k * 2);
  const top = Math.round((N - (14 * k + gap)) / 2);
  // Faux bold: each word is stamped `bold` extra times one pixel to the right,
  // so the strokes stay legible when the icon is shown small.
  const bold = Math.ceil(k / 2);
  const cx = N / 2 - bold / 2;
  for (const [word, y] of [['STICK', top], ['FLIP', top + 7 * k + gap]]) {
    for (let d = 0; d <= bold; d++) g.text(word, cx + 1 + d, y + 1, PAL.ink, k, 'center');
    for (let d = 0; d <= bold; d++) g.text(word, cx + d, y, PAL.red, k, 'center');
  }
  return g;
}

// Favicon: drawn at its real size so the pixels stay crisp in a browser tab.
const fav32 = png(icon(32, 1));
save('favicon-32.png', fav32);
writeFileSync(new URL('../favicon.ico', import.meta.url), ico(fav32, 32));

// Home Screen icons: small pixel drawings scaled up by whole numbers.
save('apple-touch-icon.png', png(icon(90, 2), 2)); // 180 x 180
save('icon-192.png', png(icon(96, 2), 2));
save('icon-512.png', png(icon(128, 3), 4));
save('icon-maskable-512.png', png(icon(128, 3), 4));

// Fills a convex quad (corners in order) pixel by pixel.
function fillQuad(g, q, color) {
  const xs = q.map((p) => p.x);
  const ys = q.map((p) => p.y);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      const [px, py] = [x + 0.5, y + 0.5];
      const inside = q.every((a, i) => {
        const b = q[(i + 1) % q.length];
        return (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x) >= 0;
      });
      if (inside) g.pset(x, y, color);
    }
  }
}

// Share preview, 1200 x 630: a 240 x 126 scene scaled by 5. The giant
// STICKFLIP wordmark centred on plain navy, with the rider mid-kickflip
// below it.
{
  const W = 240;
  const H = 126;
  const g = new Pix(fakeCtx, W, H);
  g.clear(PAL.sky);
  const ty = Math.round(H / 2 - 14); // the title is 28 pixels tall
  g.text('STICKFLIP', W / 2 + 1, ty + 1, PAL.ink, 4, 'center');
  g.text('STICKFLIP', W / 2, ty, PAL.red, 4, 'center');
  // the rider, small enough to fit between the title and the bottom edge
  const s = 0.32; // pixels per world unit
  const [fx, fy] = [W / 2, H - 7];
  drawFigure(g, makeTransform(fx / s, fy / s, 0, s), POSES.flip);
  // the board below the feet, nose tipped up: a solid black deck with
  // wheels underneath
  const tf = makeTransform(fx / s, fy / s, -0.25, s);
  const deck = [[-28, -15], [28, -15], [28, -9], [-28, -9]].map(([x, y]) => tf({ x, y }));
  fillQuad(g, deck, PAL.ink);
  deck.forEach((a, i) => {
    const b = deck[(i + 1) % deck.length];
    g.line(a.x, a.y, b.x, b.y, PAL.ink); // the edges too, so the deck has no gaps
  });
  // two 2 x 2 wheels, a pixel clear of the deck
  for (const wx of [-17, 17]) {
    const w = tf({ x: wx, y: 0 });
    g.fill(Math.round(w.x - 1), Math.round(w.y - 1), 2, 2, PAL.ink);
  }
  save('og-image.png', png(g, 5));
}

console.log('icons written to icons/ and favicon.ico');
