import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { STAGES } from '../src/stages/index.js';
import { PHYS } from '../src/config.js';
import { RES } from '../src/render/pixel.js';
import { drawSticker } from '../src/render/sticker.js';
import { RAG_SIZE } from '../src/ragdoll.js';
import { POSES } from '../src/render/stickman.js';

const DT = 1 / 60;
const bailed = (reason = 'clipped', score = 1234) => {
  const g = new Game(STAGES[0], null, { index: 2, score });
  g.tap();
  g.sk.x += 200;
  g.update(DT);
  g.bail(reason);
  return g;
};
const joints = (g) => Object.values(g.sk.bail.rag.pts);
const snapshot = (g) => JSON.stringify(joints(g).map((p) => [p.x, p.y]).concat([[g.sk.bail.bx, g.sk.bail.by, g.sk.bail.bang]]));

test('a bail is a ragdoll: the same every time, finite, never under the ground', () => {
  const run = () => {
    const g = bailed();
    for (let i = 0; i < 180; i++) {
      g.update(DT);
      for (const p of joints(g)) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
        assert.ok(p.y <= g.groundAt(p.x).y + 0.001, 'a joint went through the ground');
      }
    }
    return snapshot(g);
  };
  assert.equal(run(), run());
});

test('the limbs flop: bones keep their length while the pose changes', () => {
  const g = bailed();
  const len = (a, b) => Math.hypot(g.sk.bail.rag.pts[a].x - g.sk.bail.rag.pts[b].x, g.sk.bail.rag.pts[a].y - g.sk.bail.rag.pts[b].y);
  const want = (a, b) => Math.hypot(POSES.air[a].x - POSES.air[b].x, POSES.air[a].y - POSES.air[b].y) * RAG_SIZE;
  const start = JSON.stringify(joints(g));
  let moved = false;
  for (let i = 0; i < 40; i++) {
    g.update(DT);
    if (JSON.stringify(joints(g)) !== start) moved = true;
    for (const [a, b] of [['hip', 'kneeF'], ['kneeF', 'footF'], ['neck', 'elbowB'], ['elbowB', 'handB']]) {
      assert.ok(Math.abs(len(a, b) - want(a, b)) < want(a, b) * 0.2, `${a}-${b} stretched`);
    }
  }
  assert.ok(moved);
});

test('the body bounces off the ground and slides, then comes to rest', () => {
  const g = bailed('clipped');
  const b = g.sk.bail;
  let hitAt = null;
  let bounced = false;
  let prevVy = 0;
  for (let i = 0; i < 60 * 4; i++) {
    const before = b.rag.pts.hip.y;
    g.update(DT);
    const vy = b.rag.pts.hip.y - before;
    if (hitAt === null && b.rag.pts.hip.y >= g.groundAt(b.rag.pts.hip.x).y - 4) hitAt = i;
    if (hitAt !== null && prevVy > 0 && vy < 0) bounced = true;
    prevVy = vy;
  }
  assert.ok(hitAt !== null, 'never reached the ground');
  assert.ok(bounced, 'did not bounce');
  const x = b.rag.pts.hip.x;
  for (let i = 0; i < 60; i++) g.update(DT);
  assert.ok(Math.abs(b.rag.pts.hip.x - x) < 1.5, 'still sliding after four seconds');
});

test('the body slides along the ground after the first impact', () => {
  const g = bailed('clipped');
  const b = g.sk.bail;
  let landed = null;
  for (let i = 0; i < 240 && landed === null; i++) {
    g.update(DT);
    if (b.rag.pts.hip.y >= g.groundAt(b.rag.pts.hip.x).y - 3) landed = b.rag.pts.hip.x;
  }
  assert.ok(landed !== null);
  for (let i = 0; i < 20; i++) g.update(DT);
  assert.ok(Math.abs(b.rag.pts.hip.x - landed) > 8, 'stopped dead instead of sliding');
});

test('the board tumbles separately from the body', () => {
  const g = bailed();
  const b = g.sk.bail;
  let turned = 0;
  for (let i = 0; i < 40; i++) {
    g.update(DT);
    turned = Math.max(turned, Math.abs(b.bang));
  }
  assert.ok(turned > Math.PI, 'the board did not tumble end over end');
  assert.notEqual(Math.round(b.bx), Math.round(b.rag.pts.hip.x));
  for (let i = 0; i < 240; i++) g.update(DT);
  assert.ok(Math.abs(b.bang / Math.PI - Math.round(b.bang / Math.PI)) < 1e-9, 'settles flat');
});

test('a bail keeps its restart timing and its banked score', () => {
  const g = bailed('clipped', 4321);
  g.update(DT);
  g.tap();
  assert.equal(g.phase, 'bailed', 'a tap right after the bail must wait');
  for (let t = 0; t < PHYS.BAIL_RETRY_DELAY - 0.05; t += DT) g.update(DT);
  g.tap();
  assert.equal(g.phase, 'bailed', 'still inside the delay');
  for (let t = 0; t < 0.15; t += DT) g.update(DT);
  g.tap();
  assert.equal(g.phase, 'playing');
  assert.equal(g.score, 4321);
});

test('the camera keeps following the fallen rider (hip, lowered to the old body height)', () => {
  const g = bailed();
  for (let i = 0; i < 90; i++) g.update(DT);
  const b = g.sk.bail;
  assert.equal(b.x, b.rag.pts.hip.x);
  assert.equal(b.y, b.rag.pts.hip.y + 12);
});

// --- the LOSER sticker

function paint(opts) {
  const px = new Map();
  const g = { pset: (x, y, c) => px.set(`${x},${y}`, c.join(',')) };
  drawSticker(g, RES.W - 56, 40, 'LOSER', opts);
  return px;
}

test('the LOSER sticker is black with white lettering and a white border, tilted', () => {
  const px = paint();
  const colours = new Set(px.values());
  assert.ok(colours.has('0,0,0') && colours.has('255,255,255'), 'black and white');
  const xs = [...px.keys()].map((k) => k.split(',').map(Number));
  const w = Math.max(...xs.map((p) => p[0])) - Math.min(...xs.map((p) => p[0]));
  const h = Math.max(...xs.map((p) => p[1])) - Math.min(...xs.map((p) => p[1]));
  const flat = paint({ ang: 0 });
  const fx = [...flat.keys()].map((k) => k.split(',').map(Number));
  const fh = Math.max(...fx.map((p) => p[1])) - Math.min(...fx.map((p) => p[1]));
  assert.ok(h > fh + 6, 'tilted, so taller than the flat sticker');
  assert.ok(w > 60);
  assert.deepEqual([...paint()], [...paint()], 'the same every time');
});

test('the sticker has a peeled corner and stays in the top corner, clear of the BAIL text and the rider row', () => {
  const px = paint();
  const xs = [...px.keys()].map((k) => k.split(',').map(Number));
  assert.ok(px.size > 0 && [...px.values()].some((c) => c === '200,200,200'), 'a corner peel');
  for (const [x, y] of xs) {
    assert.ok(x >= 0 && x < RES.W && y >= 0 && y < 70, `(${x},${y}) is on screen, above the ground`);
    assert.ok(x > RES.W / 2 + 45, 'right of the BAIL! and SUCKS TO SUCK text');
  }
});
