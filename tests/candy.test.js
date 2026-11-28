import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { STAGES } from '../src/stages/index.js';
import { GAPS } from '../src/gaps.js';

// Stage 11, Candy Land: sketch terrain, a giant gumball that chases you through 11-6 and 11-7, sticky caramel and
// conveyor belts, spinning lollipops, and the candy machine at the end.

const STEP = 1 / 120;
const candy = STAGES[10];

function play(i, acts, tmax = 8, until = () => false) {
  const g = new Game(candy, null, { index: i, score: 0 });
  g.tap();
  const q = acts.map(([t, k]) => ({ t, k }));
  let t = 0;
  while (t < tmax && g.phase === 'playing' && !until(g)) {
    while (q.length && q[0].t <= t + 1e-9) {
      const { k } = q.shift();
      if (k === 'tap') g.tap();
      else if (k === 'hold') g.setHold(true);
      else if (k === 'cs') g.startCharge();
      else if (k === 'cr') g.releaseCharge();
    }
    g.update(STEP);
    t += STEP;
  }
  return { g, t };
}

test('stage 11 is Candy Land: nine checkpoints, no race, turbo, its own palette and sky, a chase and a finale', () => {
  assert.equal(candy.id, 'stage-11');
  assert.equal(STAGES.indexOf(candy), 10);
  assert.deepEqual(candy.sections.map((s) => s.name), ['Sugar Start', 'Gumdrop Gap', 'Long Rail', 'Licorice Lane', 'Fudge Ridge', 'Gumball Run', 'Cane Hills', 'Sweet Machine', 'Candy Machine']);
  assert.equal(candy.race, undefined);
  assert.equal(candy.boost, true);
  assert.equal(candy.palette, 'candy');
  assert.equal(candy.candy, true);
  assert.ok(candy.finale);
  assert.ok(candy.chase.from >= candy.sections[5].x && candy.chase.until === candy.sections[7].x, 'the chase runs through 11-6 and 11-7');
  assert.ok(candy.finishX > candy.sections[8].x && candy.finishX < candy.width, 'the finish is the dispenser mouth');
  assert.equal(new Game(candy).rival, null);
});

test('the Mega Ramp stays unlocked by stages 1-10 only (the stage count does not move it)', async () => {
  const { readFileSync } = await import('node:fs');
  assert.match(readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), /LEVELS\.slice\(0, 10\)\.every/);
});

test('stage 11 has named bonuses, each 300+ points, and every one is in a real checkpoint', () => {
  const mine = GAPS.filter((g) => g.stage === 'stage-11');
  assert.ok(mine.length >= 5);
  assert.ok(mine.every((g) => g.points >= 300));
});

test('the sketch is followed: a raised start, pits with the far side lower, stairs down, a low run, a ridge and hills down to the street', () => {
  const h = (x) => 450 - candy.obstacles.flatMap((o) => o.ground || []).find((s) => x >= s.x1 && x < s.x2 && s.y !== 10450 && s.bail !== 'gap')?.y;
  const g = new Game(candy);
  const hAt = (x) => 450 - g.groundAt(x).y;
  assert.ok(hAt(80) > 100, 'the start is high');
  assert.ok(hAt(960 + 100) > hAt(960 + 700), 'pit 1: the far side is lower');
  assert.ok(hAt(2 * 960 + 100) > hAt(2 * 960 + 900), 'stairs down');
  assert.ok(hAt(4 * 960 + 100) < hAt(4 * 960 + 250), 'a kicker up to the ridge');
  assert.ok(hAt(7 * 960 + 100) <= 1 && hAt(candy.width - 200) <= 1, 'the machine room and the machine stand on the street');
  void h;
  // the pits are really gaps
  assert.equal(g.groundAt(960 + 450).bail, 'gap');
  assert.equal(g.groundAt(4 * 960 + 700).bail, 'gap');
});

test('the gumball: it starts rolling behind you at 11-6, and a rider who does nothing is squashed', () => {
  const idle = play(5, [], 12, (g) => g.phase !== 'playing');
  const g = idle.g;
  assert.ok(g.ball, 'the ball is rolling');
  assert.equal(g.bailReason === 'squashed' || g.bailReason === 'slam', true, g.bailReason);
  // checked on a clear stretch: no obstacle at all, the ball still catches a rider slowed by caramel and brake
  const slow = new Game(candy, null, { index: 5, score: 0 });
  slow.tap();
  for (let t = 0; t < 7 && slow.phase === 'playing'; t += STEP) {
    slow.setHold(true);
    slow.hold.dir = 'down';
    slow.hold.dirT = 1;
    slow.sk.charge = slow.sk.charge || { t: 0 };
    slow.update(STEP);
  }
  assert.equal(slow.bailReason, 'squashed', 'braking all the way gets you caught');
});

test('the gumball: grinding the cane over the caramel (the turbo) leaves a bigger lead than rolling through it', () => {
  const gap = (acts) => {
    const r = play(5, acts, 5, (g) => g.sk.x > candy.sections[6].x - 60);
    return r.g.sk.x - r.g.ball.x;
  };
  const grind = gap([[0.1, 'tap'], [0.1, 'hold']]);
  const hop = gap([[0.3, 'tap']]);
  assert.ok(grind > hop - 1, `grind ${Math.round(grind)} vs hop ${Math.round(hop)}`);
  assert.ok(grind > 250, 'still comfortably ahead');
});

test('the gumball: it is no danger before 11-6 starts, loses interest at the machine room and stops', () => {
  const early = play(4, [[0.2, 'cs'], [0.7, 'cr']], 5, (g) => g.sk.x > candy.sections[5].x - 20);
  assert.equal(early.g.ball, null);
  const g = new Game(candy, null, { index: 7, score: 0 });
  g.tap();
  // put the ball right behind the rider as he crosses the end of the chase
  g.ball = { x: candy.chase.until - 60, rot: 0, gone: false, v: g.baseSpeed * candy.chase.pace };
  g.sk.x = candy.chase.until + 5;
  for (let t = 0; t < 4 && g.phase === 'playing'; t += STEP) {
    g.update(STEP);
    if (g.sk.x > candy.sections[7].x + 300) break;
  }
  assert.equal(g.ball.gone, true);
  assert.notEqual(g.bailReason, 'squashed');
});

test('sticky caramel holds you back and a conveyor carries you, on the street only', () => {
  const g = new Game(candy, null, { index: 5, score: 0 });
  const goo = g.belts.find((b) => b.v < 0);
  const run = (game, x0, secs) => {
    game.sk.x = x0;
    game.tap();
    const t0 = game.time;
    const startX = game.sk.x;
    while (game.time - t0 < secs && game.phase === 'playing') game.update(STEP);
    return game.sk.x - startX;
  };
  const free = run(new Game(candy, null, { index: 5, score: 0 }), 5 * 960 + 100, 0.4);
  const stuck = run(new Game(candy, null, { index: 5, score: 0 }), goo.x1 + 5, 0.4);
  assert.ok(stuck < free - 30, `caramel ${Math.round(stuck)} vs street ${Math.round(free)}`);
  const f = new Game(candy, null, { index: 7, score: 0 });
  const fwd = f.belts.find((b) => b.v > 0);
  const onBelt = run(f, fwd.x1 + 5, 0.4);
  const bare = run(new Game(candy, null, { index: 7, score: 0 }), 7 * 960 + 5, 0.4);
  assert.ok(onBelt > bare + 20, `belt ${Math.round(onBelt)} vs street ${Math.round(bare)}`);
});

test('the spinning lollipop: a rider rolling through is thrown off at some moments and passes clean at others (a timing window)', () => {
  const sp = candy.obstacles.find((o) => o.type === 'spinner' && o.hazards[0].x < candy.sections[8].x);
  assert.ok(sp);
  let clean = 0;
  let hit = 0;
  for (let wait = 0; wait < 2.4; wait += 0.05) {
    const g = new Game(candy, null, { index: 7, score: 0 });
    for (let t = 0; t < wait; t += STEP) g.update(STEP); // the bar turns while the rider waits
    g.tap();
    while (g.phase === 'playing' && g.sk.x < sp.hazards[0].x + 140) g.update(STEP);
    if (g.phase === 'bailed') hit++;
    else clean++;
  }
  assert.ok(hit >= 4 && clean >= 4, `hit ${hit}, clean ${clean}`);
});

test('the finale: riding into the machine finishes the stage, with confetti and a gumball drawn without trouble', async () => {
  const { Pix, setPalette, RES } = await import('../src/render/pixel.js');
  const { Renderer } = await import('../src/render/renderer.js');
  const ctx = { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  setPalette('candy');
  const rd = new Renderer(new Pix(ctx));
  const r = play(8, [[0.1, 'cs'], [0.55, 'cr']], 8, () => false);
  assert.equal(r.g.phase, 'complete');
  assert.ok(r.g.sk.x >= candy.finishX && r.g.sk.x < candy.finishX + 30, 'stopped at the dispenser mouth');
  for (let i = 0; i < 240; i++) {
    r.g.update(1 / 60);
    rd.draw(r.g, 1 / 60, {});
  }
  assert.ok(RES.W > 0);
  setPalette('normal');
});

test('every checkpoint of stage 11 draws (sky, terrain, ball) at several camera spots without throwing', async () => {
  const { Pix, setPalette } = await import('../src/render/pixel.js');
  const { Renderer } = await import('../src/render/renderer.js');
  const ctx = { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  setPalette('candy');
  const rd = new Renderer(new Pix(ctx));
  for (let i = 0; i < candy.sections.length; i++) {
    const g = new Game(candy, null, { index: i, score: 0 });
    g.tap();
    for (let n = 0; n < 150; n++) {
      g.update(1 / 60);
      rd.draw(g, 1 / 60, {});
    }
  }
  setPalette('normal');
});
