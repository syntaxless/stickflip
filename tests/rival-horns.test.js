import test from 'node:test';
import assert from 'node:assert/strict';
import { Pix } from '../src/render/pixel.js';
import { POSES, makeTransform, drawFigure } from '../src/render/stickman.js';

const WHITE = [255, 255, 255];
const mk = () => new Pix({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, 40, 44);
const whiteCols = (opts) => {
  const g = mk();
  g.clear([0, 0, 0]);
  drawFigure(g, makeTransform(60, 120, 0), POSES.roll, opts);
  const cols = new Set();
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (Array.from(g.data.slice((y * g.w + x) * 4, (y * g.w + x) * 4 + 3)).join() === WHITE.join()) cols.add(x);
  return cols;
};
const base = { color: [238, 232, 214], noCap: true, eyes: true };

test('Hellride rival horns: white, none without the option', () => {
  assert.equal(whiteCols(base).size, 0);
  assert.ok(whiteCols({ ...base, horns: WHITE }).size > 0);
});

test('facing the player both horns show, one on each side of the head', () => {
  const cols = [...whiteCols({ ...base, horns: WHITE, eyes: 'laugh' })].sort((a, b) => a - b);
  const mid = (cols[0] + cols[cols.length - 1]) / 2;
  assert.ok(cols.some((x) => x < mid - 3) && cols.some((x) => x > mid + 3));
});
