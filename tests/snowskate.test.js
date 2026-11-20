import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { STAGES } from '../src/stages/index.js';
import { Pix, PAL, setPalette } from '../src/render/pixel.js';
import { drawBoard, makeTransform } from '../src/render/stickman.js';
import { Renderer } from '../src/render/renderer.js';

// Frostbite (Stage 7) is ridden on a snow skate: no wheels or trucks. Only the picture changes.

const stubCtx = { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
const whitePixels = (pix) => {
  let n = 0;
  for (let p = 0; p < pix.data.length; p += 4) if (pix.data[p] === 255 && pix.data[p + 1] === 255 && pix.data[p + 2] === 255) n++;
  return n;
};
const board = (wheels, spin = 0) => {
  const pix = new Pix(stubCtx);
  pix.clear([40, 40, 40]);
  drawBoard(pix, makeTransform(160, 100, 0), spin, 0, PAL.deck, wheels);
  return pix;
};

test('a normal board draws white wheels; a snow skate does not, at rest or mid-flip', () => {
  assert.ok(whitePixels(board(true)) >= 2, 'wheels under the board');
  assert.equal(whitePixels(board(false)), 0, 'no wheels on a snow skate');
  assert.ok(whitePixels(board(true, Math.PI * 0.6)) >= 2, 'wheels show on a flipped board');
  assert.equal(whitePixels(board(false, Math.PI * 0.6)), 0, 'a flipped snow skate has none');
  const some = (pix) => { let n = 0; for (let p = 0; p < pix.data.length; p += 4) if (pix.data[p] === PAL.deck[0] && pix.data[p + 1] === PAL.deck[1]) n++; return n; };
  assert.ok(some(board(false)) > some(board(true)), 'a thicker deck instead');
});

test('only Frostbite has a snow skate; the other stages keep their wheels', () => {
  for (const st of STAGES) assert.equal(!!st.snowSkate, st.id === 'stage-7', st.id);
});

test('the snow skate changes nothing about play: same inputs, same path, wheels or not', () => {
  const run = (st) => {
    const g = new Game(st, null, { index: 1, score: 0 });
    g.tap();
    let t = 0;
    while (t < 2 && g.phase === 'playing') {
      if (Math.abs(t - 0.61) < 1 / 240) { g.tap(); g.setHold(true); }
      g.update(1 / 120);
      t += 1 / 120;
    }
    return [Math.round(g.sk.x), Math.round(g.sk.y), g.score];
  };
  const frost = STAGES[6];
  assert.deepEqual(run(frost), run({ ...frost, snowSkate: false }));
});

test('Frostbite draws with the snow skate through a flip, a grind and a bail without throwing', () => {
  setPalette('frost');
  const frost = STAGES[6];
  const pix = new Pix(stubCtx);
  const r = new Renderer(pix);
  const game = new Game(frost, null, { index: 1, score: 0 });
  game.tap();
  for (let i = 0; i < 90; i++) game.update(1 / 120);
  game.tap();
  game.swipe('kickflip');
  for (let i = 0; i < 30; i++) { game.update(1 / 120); r.drawScene(pix, game, Renderer.prototype.camera.call({}, game)); }
  game.bail('slam');
  for (let i = 0; i < 30; i++) { game.update(1 / 120); r.drawScene(pix, game, Renderer.prototype.camera.call({}, game)); }
  setPalette('normal');
});
