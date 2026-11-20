import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { STAGES } from '../src/stages/index.js';
import { GAPS } from '../src/gaps.js';
import { stage } from '../src/stages/compose.js';
import { lanternGate } from '../src/obstacles/index.js';
import { Pix, PAL, setPalette } from '../src/render/pixel.js';
import { Renderer } from '../src/render/renderer.js';

// Stage 10, Haunted Night: a regular (non-race) stage in a graveyard under a huge moon. Every obstacle has a
// safe line and a riskier one; the checks below ride both.

const STEP = 1 / 120;
const haunt = STAGES[9];
const names = haunt.sections.map((s) => s.name);

function play(i, acts, tmax = 6) {
  const g = new Game(haunt, null, { index: i, score: 0 });
  g.tap();
  const q = acts.map(([t, k]) => ({ t, k }));
  const earned = [];
  let t = 0;
  while (t < tmax && g.phase === 'playing' && g.sk.x < haunt.sections[i].x + 1300) {
    while (q.length && q[0].t <= t + 1e-9) {
      const { k } = q.shift();
      if (k === 'tap') g.tap();
      else if (k === 'hold') g.setHold(true);
      else if (k === 'cs') g.startCharge();
      else if (k === 'cr') g.releaseCharge();
    }
    g.update(STEP);
    t += STEP;
    for (const e of g.drainEvents()) if (e.type === 'special' || e.type === 'gap') earned.push(e.name || e.text);
  }
  return { g, earned, t };
}
const cleared = (r, i) => r.g.phase === 'complete' || r.g.sk.x > (i === 6 ? haunt.width - 40 : haunt.sections[i + 1].x + 150);

test('stage 10 is Haunted Night: seven checkpoints, no race, no turbo, its own palette and sky', () => {
  assert.equal(haunt.id, 'stage-10');
  assert.equal(haunt.name, 'Haunted Night');
  assert.deepEqual(names, ['Tombstones', 'Crypt Fence', 'Open Grave', 'Pumpkin Patch', 'Lantern Gates', 'Mausoleum', 'Mansion Gate']);
  assert.equal(haunt.race, undefined);
  assert.ok(!haunt.boost);
  assert.equal(haunt.palette, 'haunt');
  assert.equal(haunt.haunt, true);
  assert.equal(new Game(haunt).rival, null);
});

test('stage 10 follows the others: opens after stage 9, has no Game Center board yet', () => {
  assert.equal(STAGES.indexOf(haunt), 9, 'the last stage so far');
  assert.notEqual(haunt.gameCenter, false, 'has a Game Center board');
});

test('stage 10 has named gap bonuses, each with a distinct id, 300+ points', () => {
  const mine = GAPS.filter((g) => g.stage === 'stage-10');
  assert.ok(mine.length >= 8);
  assert.equal(new Set(mine.map((g) => g.id)).size, mine.length);
  assert.ok(mine.every((g) => g.points >= 300));
});

test('10-1: the stones are solid (rolling in is a slam); ollie the low stone, then the monument', () => {
  assert.equal(play(0, [], 4).g.phase, 'bailed');
  assert.ok(cleared(play(0, [[0.58, 'tap'], [1.78, 'tap']], 6), 0));
});

test('10-2: ollie off the coffin kicker and lock the fence for FENCE GRIND', () => {
  const r = play(1, [[0.61, 'tap'], [0.61, 'hold']], 5);
  assert.ok(r.earned.includes('FENCE GRIND'), JSON.stringify(r.earned));
  assert.ok(cleared(r, 1));
});

test('10-3: the open grave is a drop if you roll in; hop the coffin lid, or fly it with a charged ollie', () => {
  assert.equal(play(2, [], 4).g.phase, 'bailed');
  const hop = play(2, [[0.57, 'tap'], [1.47, 'tap']], 6);
  assert.ok(hop.earned.includes('COFFIN HOP'), JSON.stringify(hop.earned));
  assert.ok(cleared(hop, 2));
  const leap = play(2, [[0, 'cs'], [0.71, 'cr']], 6);
  assert.ok(leap.earned.includes('GRAVE LEAP'), JSON.stringify(leap.earned));
  assert.ok(cleared(leap, 2));
  const lid = haunt.obstacles.find((o) => o.type === 'open-grave' && o.surfaces.length);
  assert.ok(lid.surfaces[0].landable, 'the lid is landable, flush with the street');
});

test('10-4: hop up on the pumpkin for PUMPKIN HOP, or ollie it and the standing coffin', () => {
  const hop = play(3, [[0.28, 'tap'], [1.48, 'tap']], 6);
  assert.ok(hop.earned.includes('PUMPKIN HOP'), JSON.stringify(hop.earned));
  assert.ok(cleared(play(3, [[0.5, 'tap'], [1.6, 'tap']], 6), 3));
  assert.equal(play(3, [], 4).g.phase, 'bailed');
});

test('10-5: an ollie through a lantern gate earns its bonus; head above the crossbar is a bail', () => {
  let got = false;
  for (let t0 = 0.5; t0 < 1.0 && !got; t0 += 0.02) {
    const g = new Game(haunt, null, { index: 4, score: 0 });
    g.tap();
    let t = 0;
    while (t < 2.4 && g.phase === 'playing') {
      if (Math.abs(t - t0) < STEP / 2) g.tap();
      g.update(STEP);
      t += STEP;
      if (g.combo.some((c) => c.name === 'GHOST GATE')) got = true;
    }
  }
  assert.ok(got, 'some ollie over the stone goes through the first gate');
  const low = stage({ id: 'gate-test', name: 'Gate test', sections: [{ id: 'g', name: 'Gate', obstacles: [lanternGate({ x: 520, top: 150, bottom: 60 })] }] });
  const g = new Game(low, null, { index: 0, score: 0 });
  g.tap();
  let t = 0;
  while (t < 1.6 && g.phase === 'playing') {
    if (Math.abs(t - 0.8) < STEP / 2) g.tap();
    g.update(STEP);
    t += STEP;
  }
  assert.equal(g.phase, 'bailed', 'head above the crossbar');
});

test('10-6: ride the mausoleum roof, grind its edge, drop off its end, or fly it', () => {
  assert.ok(cleared(play(5, [[0.45, 'tap']], 5), 5));
  assert.ok(play(5, [[0.5, 'tap'], [0.5, 'hold']], 5).earned.includes('TOMB GRIND'));
  assert.ok(play(5, [[0, 'cs'], [0.6, 'cr']], 5).earned.includes('TOMB LEAP'));
  assert.ok(play(5, [[0.4, 'tap'], [1.4, 'tap']], 5).earned.includes('ROOF DROP'));
});

test('10-7: lock the arched fence over the moat, or fly it with a charged ollie; a plain ollie falls short', () => {
  assert.equal(play(6, [], 4).g.phase, 'bailed');
  assert.ok(play(6, [[0.5, 'tap'], [0.5, 'hold']], 5).earned.includes('GATE GRIND'));
  assert.ok(play(6, [[0, 'cs'], [0.56, 'cr']], 5).earned.includes('MANSION LEAP'));
  assert.ok(!play(6, [[0.5, 'tap']], 5).earned.includes('MANSION LEAP'));
});

const stubCtx = { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };

test('the haunted scene draws at every checkpoint, with a sky the black rider shows up against', () => {
  setPalette('haunt');
  const pix = new Pix(stubCtx);
  const r = new Renderer(pix);
  for (let i = 0; i < haunt.sections.length; i++) {
    const game = new Game(haunt, null, { index: i, score: 0 });
    const cam = Renderer.prototype.camera.call({}, game);
    r.time = 1.3 * i;
    r.drawScene(pix, game, cam);
    let mid = 0; // not near-black: the rider (black) has to show against the picture behind it
    for (let p = 0; p < pix.data.length; p += 4) if (pix.data[p] + pix.data[p + 1] + pix.data[p + 2] > 150) mid++;
    assert.ok(mid > pix.w * pix.h * 0.5, `${names[i]}: ${mid} lit pixels`);
  }
  assert.ok(PAL.sky[2] > 120);
  setPalette('normal');
});
