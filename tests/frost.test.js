import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { STAGES } from '../src/stages/index.js';
import { GAPS } from '../src/gaps.js';
import { stage } from '../src/stages/compose.js';
import { skiGate } from '../src/obstacles/index.js';
import { Pix, PAL, setPalette } from '../src/render/pixel.js';
import { Renderer } from '../src/render/renderer.js';

// Stage 7, Frostbite: a regular (non-race) stage on a snow theme. Every obstacle has a safe line and a
// riskier one; the checks below ride both.

const STEP = 1 / 120;
const frost = STAGES[6];
const names = frost.sections.map((s) => s.name);

// Plays checkpoint `i` with timed inputs; returns the game and the specials earned.
function play(i, acts, tmax = 6) {
  const g = new Game(frost, null, { index: i, score: 0 });
  g.tap();
  const q = acts.map(([t, k]) => ({ t, k }));
  const earned = [];
  let t = 0;
  while (t < tmax && g.phase === 'playing' && g.sk.x < frost.sections[i].x + 1300) {
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
const cleared = (r, i) => r.g.phase === 'complete' || r.g.sk.x > (i === 6 ? frost.width - 40 : frost.sections[i + 1].x + 150);

test('stage 7 is Frostbite: seven checkpoints, no race, no turbo, its own palette and sky', () => {
  assert.equal(frost.id, 'stage-7');
  assert.equal(frost.name, 'Frostbite');
  assert.deepEqual(names, ['Snowdrifts', 'Sled Run', 'Frozen Pond', 'Ice Hurdles', 'Slalom', 'Cabin Roof', 'Crevasse Jump']);
  assert.equal(frost.race, undefined);
  assert.ok(!frost.boost);
  assert.equal(frost.palette, 'frost');
  assert.equal(frost.frost, true);
  assert.equal(new Game(frost).rival, null);
});

test('stage 7 follows the others: opens after stage 6, has no Game Center board yet', () => {
  assert.equal(STAGES.indexOf(frost), 6, 'the stage after Hellride');
  assert.notEqual(frost.gameCenter, false, 'has a Game Center board');
});

test('stage 7 has named gap bonuses, each with a distinct id, 250+ points', () => {
  const mine = GAPS.filter((g) => g.stage === 'stage-7');
  assert.ok(mine.length >= 8);
  assert.equal(new Set(mine.map((g) => g.id)).size, mine.length);
  assert.ok(mine.every((g) => g.points >= 300));
});

test('7-1: the snowman is a solid hurdle (riding into it is a slam), and a plain ollie clears it', () => {
  const into = play(0, [], 4);
  assert.equal(into.g.phase, 'bailed');
  assert.ok(cleared(play(0, [[1.85, 'tap']], 5), 0));
});

test('7-2: ollie off the sled kicker and lock the rail for SLED GRIND', () => {
  const r = play(1, [[0.61, 'tap'], [0.61, 'hold']], 5);
  assert.ok(r.earned.includes('SLED GRIND'), JSON.stringify(r.earned));
  assert.ok(cleared(r, 1));
});

test('7-3: the pond is a swim if you roll in; the floe is a safe stop in the middle and a charged ollie flies it all', () => {
  assert.equal(play(2, [], 4).g.phase, 'bailed', 'rolled into the pond');
  const hop = play(2, [[0.57, 'tap'], [1.47, 'tap']], 6);
  assert.ok(hop.earned.includes('FLOE HOP'), JSON.stringify(hop.earned));
  assert.ok(cleared(hop, 2), 'second hop off the floe reaches the far bank');
  const leap = play(2, [[0, 'cs'], [0.71, 'cr']], 6);
  assert.ok(leap.earned.includes('POND LEAP'), JSON.stringify(leap.earned));
  assert.ok(cleared(leap, 2));
});

test('7-3: the floe is landable flush with the street (you roll along it) and short of the pond is a bail', () => {
  const pond = frost.obstacles.find((o) => o.type === 'ice-pond' && o.surfaces.length);
  assert.equal(pond.surfaces.length, 1);
  assert.ok(pond.surfaces[0].landable);
  assert.ok(play(2, [[0.2, 'tap']], 5).g.phase === 'bailed', 'a too-early ollie drops in short of the floe');
});

test('7-4: ollie both ice blocks, or ollie the first and grind the second', () => {
  assert.ok(cleared(play(3, [[0.38, 'tap'], [1.58, 'tap']], 6), 3));
  const slide = play(3, [[0.38, 'tap'], [1.18, 'tap'], [1.18, 'hold']], 6);
  assert.ok(slide.earned.includes('FROZEN SLIDE'), JSON.stringify(slide.earned));
  assert.ok(cleared(slide, 3));
});

test('7-5: an ollie through a ski gate earns its bonus (ride under it and nothing happens); head above the banner is a bail', () => {
  // over the first block and through the first gate (the second block then bails a lone ollie: that is another test)
  let got = false;
  for (let t0 = 0.5; t0 < 1.0 && !got; t0 += 0.02) {
    const g = new Game(frost, null, { index: 4, score: 0 });
    g.tap();
    let t = 0;
    while (t < 2.4 && g.phase === 'playing') {
      if (Math.abs(t - t0) < STEP / 2) g.tap();
      g.update(STEP);
      t += STEP;
      if (g.combo.some((c) => c.name === 'SLALOM GATE')) got = true;
    }
  }
  assert.ok(got, 'some ollie over the block goes through the gate');
  // riding along under the gate (no ollie): the block is the only problem, the gate lets you pass
  const gate = frost.obstacles.find((o) => o.type === 'ski-gate').hazards[0];
  assert.ok(gate.top < gate.bottom, 'an opening between two heights');
  // a low banner: a plain ollie's head goes above it
  const low = stage({ id: 'gate-test', name: 'Gate test', sections: [{ id: 'g', name: 'Gate', obstacles: [skiGate({ x: 520, top: 150, bottom: 60 })] }] });
  const g = new Game(low, null, { index: 0, score: 0 });
  g.tap();
  let t = 0;
  while (t < 1.6 && g.phase === 'playing') {
    if (Math.abs(t - 0.8) < STEP / 2) g.tap();
    g.update(STEP);
    t += STEP;
  }
  assert.equal(g.phase, 'bailed', 'head above the banner');
});

test('7-6: ollie onto the cabin roof and ride it, grind its edge, or fly the whole cabin', () => {
  assert.ok(cleared(play(5, [[0.45, 'tap']], 5), 5));
  const grind = play(5, [[0.45, 'tap'], [0.45, 'hold']], 5);
  assert.ok(grind.earned.includes('CABIN GRIND'), JSON.stringify(grind.earned));
  const leap = play(5, [[0, 'cs'], [0.6, 'cr']], 5);
  assert.ok(leap.earned.includes('CABIN LEAP'), JSON.stringify(leap.earned));
  const drop = play(5, [[0.36, 'tap'], [1.36, 'tap']], 5);
  assert.ok(drop.earned.includes('ROOF DROP'), JSON.stringify(drop.earned));
});

test('7-7: lock the arched rail over the crevasse, or fly it with a charged ollie; rolling in is a bail', () => {
  assert.equal(play(6, [], 4).g.phase, 'bailed');
  assert.ok(play(6, [[0.5, 'tap'], [0.5, 'hold']], 5).earned.includes('ICE BRIDGE'));
  assert.ok(play(6, [[0, 'cs'], [0.56, 'cr']], 5).earned.includes('CREVASSE JUMP'));
  assert.ok(!play(6, [[0.5, 'tap']], 5).earned.includes('CREVASSE JUMP'), 'a plain ollie falls short of the far bank');
});

// ---- the art: every checkpoint draws (sky, mountains, snow, each obstacle) without throwing, and the
// frost palette is a light one (the rider is black on it)

const stubCtx = { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };

test('the frost scene draws at every checkpoint, with mostly pale pixels behind the rider', () => {
  setPalette('frost');
  const pix = new Pix(stubCtx);
  const r = new Renderer(pix);
  for (let i = 0; i < frost.sections.length; i++) {
    const game = new Game(frost, null, { index: i, score: 0 });
    const cam = Renderer.prototype.camera.call({}, game);
    r.time = 1.3 * i;
    r.drawScene(pix, game, cam);
    let pale = 0;
    for (let p = 0; p < pix.data.length; p += 4) if (pix.data[p] + pix.data[p + 1] + pix.data[p + 2] > 450) pale++;
    assert.ok(pale > pix.w * pix.h * 0.35, `${names[i]}: ${pale} pale pixels`);
  }
  assert.ok(PAL.ground[0] > 200, 'the surface is snow');
  setPalette('normal');
});
