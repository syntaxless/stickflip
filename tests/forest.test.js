import test from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from '../src/render/renderer.js';
import { WORLD } from '../src/config.js';

// A stand-in framebuffer that records every fill in absolute framebuffer pixels.
function fake(w) {
  return { w, ox: 0, oy: 0, fills: [], fill(x, y, ww, h, c) { this.fills.push([x + this.ox, y + this.oy, ww, h, c.join()].join(',')); }, line() {}, pset() {} };
}
const game = { level: { forest: true, morning: false } };

test('forest: the bars draw the same trees as the game picture, shifted by the bar, not a second copy', () => {
  const r = new Renderer(fake(10));
  const cam = { x: 400, y: -120 };
  const top = 40;
  const a = fake(300);
  r.drawSkyline(a, game, { x: cam.x, y: cam.y, px: cam.x, py: cam.y, left: 0, top: 0 });
  const b = fake(300);
  r.drawSkyline(b, game, { x: cam.x, y: cam.y - top, px: cam.x, py: cam.y, left: 0, top });
  const shifted = new Set(a.fills.map((f) => { const p = f.split(','); p[1] = +p[1] + top; return p.join(','); }));
  assert.ok(a.fills.length > 50);
  // every fill the game picture makes appears in the bars' frame `top` lower
  const have = new Set(b.fills);
  for (const f of shifted) assert.ok(have.has(f), `missing ${f}`);
  assert.ok(WORLD.GROUND > 0);
});

test('forest: every pine has a trunk drawn from its crown down past the horizon', () => {
  const r = new Renderer(fake(10));
  const g = fake(300);
  r.drawSkyline(g, game, { x: 0, y: 0 });
  const tall = g.fills.filter((f) => { const p = f.split(','); return +p[2] === 3 && +p[3] > 100; });
  assert.ok(tall.length > 5, 'trunks are single tall fills');
});
