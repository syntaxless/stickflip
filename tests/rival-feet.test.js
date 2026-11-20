import test from 'node:test';
import assert from 'node:assert/strict';
import { Pix } from '../src/render/pixel.js';
import { POSES, makeTransform, drawFigure, drawBoard } from '../src/render/stickman.js';

const mk = () => new Pix({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, 60, 40);
const at = (g, x, y) => Array.from(g.data.slice((y * g.w + x) * 4, (y * g.w + x) * 4 + 3));

test("a coloured rival's outline never paints over the wheels under his feet", () => {
  const WHEEL = [255, 105, 180];
  const tf = makeTransform(30 * 3, 30 * 3, 0);
  const count = (opts) => {
    const g = mk();
    g.clear([0, 0, 0]);
    drawBoard(g, tf, 0, 0, [204, 146, 76], true, WHEEL);
    drawFigure(g, tf, POSES.roll, opts);
    let n = 0;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (at(g, x, y).join() === WHEEL.join()) n++;
    return n;
  };
  // the outlined rival hides no more wheel than the plain black rider does
  assert.ok(count({ color: [157, 255, 0], noCap: true }) >= count({}));
});
