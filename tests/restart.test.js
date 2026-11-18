import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { STAGES, SECRET } from '../src/stages/index.js';
import { PHYS, WORLD } from '../src/config.js';
import { Renderer } from '../src/render/renderer.js';

// Every restart point (a checkpoint, after a bail) puts the rider somewhere fair:
// on the street, outside every obstacle, with run-up, the right camera, speed, score
// and no leftover combo, manual, charge or grind from the attempt that bailed.

const STEP = 1 / 120;
const ALL = [...STAGES, SECRET];
const MIN_RUNUP = 180; // world units between the spawn and the first thing to jump, grind or fall into (0.5 s)
const SCORE = 1234; // banked before the checkpoint
const RIDER_H = 90; // generous standing height

const sectionsOf = (st) => st.sections || [{ name: st.name, x: 0 }];
const label = (st, i) => `${st.name} checkpoint ${i + 1} (${sectionsOf(st)[i].name})`;
const camera = (game) => Renderer.prototype.camera.call({}, game);
const fresh = (st, i, score = SCORE) => new Game(st, null, { index: i, score });
const checkpoints = ALL.flatMap((st) => sectionsOf(st).map((_, i) => [st, i]));

// What is ahead of x that needs a decision: a solid, a rail, a hazard, or ground that
// is not safe to land on (gap, stairs). Banks and ramps are ridden, not decided.
function nextObstacleX(game, x) {
  const xs = [];
  for (const r of game.solids) if (r.x + r.w > x) xs.push(Math.max(r.x, x));
  for (const s of game.surfaces) if (s.x2 > x) xs.push(Math.max(s.x1, x));
  for (const h of game.hazards) if (h.x > x) xs.push(h.x);
  for (const g of game.groundSegs) if (g.x2 > x && (g.landable === false || g.bail)) xs.push(Math.max(g.x1, x));
  return xs.length ? Math.min(...xs) : Infinity;
}

test('there are 5 stages (7 checkpoints each, 4 in stage 2) and the Mega Ramp', () => {
  assert.equal(STAGES.length, 5);
  STAGES.forEach((st, n) => assert.equal(st.sections.length, n === 1 ? 4 : 7, st.id));
  assert.ok(SECRET);
});

for (const [st, i] of checkpoints) {
  test(`spawn: ${label(st, i)} is on the street, outside every obstacle, with run-up`, () => {
    const game = fresh(st, i);
    const s = game.sk;
    assert.equal(game.phase, 'ready');
    const ground = game.groundAt(s.x);
    assert.equal(s.y, ground.y, 'standing on the ground');
    assert.notEqual(ground.landable, false, 'ground can be landed on');
    assert.ok(!ground.bail && !ground.wall, 'not a gap, stairs or wall');
    assert.ok(s.y < WORLD.GROUND + 40, 'not in a pit');
    // not inside or past an obstacle
    for (const r of game.solids) {
      const inside = s.x + 18 > r.x && s.x - 18 < r.x + r.w && s.y > r.y && s.y - RIDER_H < r.y + r.h;
      assert.ok(!inside, `spawn x ${s.x} is inside the solid at ${r.x}`);
    }
    for (const surf of game.surfaces) assert.ok(!(surf.x2 > s.x - 40 && surf.x1 < s.x + 40), `a rail is at the spawn (${surf.x1})`);
    for (const h of game.hazards) assert.ok(Math.abs(h.x - s.x) > 60, 'hazard at the spawn');
    const run = nextObstacleX(game, s.x) - s.x;
    assert.ok(run >= MIN_RUNUP, `only ${Math.round(run)} of run-up before the first obstacle`);
    // after the tap: rolling at full cruising speed, with nothing left over
    game.tap();
    assert.equal(game.phase, 'playing');
    assert.equal(s.mode, 'roll');
    assert.equal(game.speed, game.baseSpeed);
    assert.equal(s.vx, game.baseSpeed);
    assert.equal(s.dir, 1);
    assert.equal(game.score, SCORE, 'the banked score carries over');
    assert.deepEqual(game.combo, []);
    assert.equal(game.sectionName, sectionsOf(st)[i].name);
    // the camera has the rider comfortably on screen
    const cam = camera(game);
    const sx = s.x - cam.x * 3;
    const sy = s.y - cam.y * 3;
    assert.ok(sx > 60 && sx < WORLD.W - 200, `rider at screen x ${sx}`);
    assert.ok(sy > 120 && sy < WORLD.H - 20, `rider at screen y ${sy}`);
    assert.ok(cam.x >= 0 && cam.x * 3 + WORLD.W <= game.width + 3, 'camera stays inside the stage');
  });
}

// ---- bail and retry

// Plays `acts` ([time, kind]) from a checkpoint until `stop(game, t)`; then bails.
function playUntil(st, i, acts, stop, tmax = 6) {
  const game = fresh(st, i);
  game.tap();
  const q = [...acts].sort((a, b) => a[0] - b[0]);
  let t = 0;
  while (t < tmax && game.phase === 'playing' && !stop(game, t)) {
    while (q.length && q[0][0] <= t + 1e-9) {
      const [, k, dir] = q.shift();
      if (k === 'tap') game.tap();
      else if (k === 'hold') game.setHold(true, dir || null);
      else if (k === 'up') game.setHold(false);
      else if (k === 'cs') game.startCharge();
      else if (k === 'cr') game.releaseCharge();
    }
    game.update(STEP);
    t += STEP;
  }
  return { game, t, stopped: game.phase === 'playing' };
}

// Bails the game (if it is still playing), lets the ragdoll fall, taps to retry
// and checks that the restart is the same as a fresh start of the checkpoint.
function bailAndRetry(game, st, i, why, reason = 'slam') {
  const cp = game.checkpoint.index;
  const banked = game.checkpoint.score;
  if (game.phase === 'playing') game.bail(reason);
  assert.equal(game.phase, 'bailed', why);
  game.tap(); // too soon: nothing happens
  assert.equal(game.phase, 'bailed', `${why}: a tap straight after the bail must not restart`);
  for (let t = 0; t < PHYS.BAIL_RETRY_DELAY + 0.05; t += STEP) {
    game.update(STEP);
    const b = game.sk.bail;
    assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.bx) && Number.isFinite(b.by), `${why}: ragdoll went NaN`);
  }
  game.tap();
  assert.equal(game.phase, 'playing', `${why}: softlocked on the bail screen`);
  const ref = fresh(st, game.checkpoint.index, banked);
  ref.tap();
  const s = game.sk;
  const r = ref.sk;
  assert.equal(game.checkpoint.index, cp, `${why}: the checkpoint moved`);
  assert.equal(s.x, r.x, `${why}: spawn x`);
  assert.equal(s.y, r.y, `${why}: spawn y`);
  assert.equal(s.mode, 'roll', `${why}: mode`);
  assert.equal(s.vx, r.vx, `${why}: vx`);
  assert.equal(s.vy, 0, `${why}: vy`);
  assert.equal(s.dir, 1);
  for (const k of ['manual', 'charge', 'flip', 'grind', 'ramp', 'qpAir', 'poppedAt', 'support', 'bail']) assert.equal(s[k], null, `${why}: left over ${k}`);
  assert.equal(s.primed, false);
  assert.equal(game.speed, game.baseSpeed, `${why}: speed`);
  assert.equal(game.cruise, game.baseSpeed, `${why}: cruise`);
  assert.equal(game.score, banked, `${why}: score`);
  assert.deepEqual(game.combo, [], `${why}: combo`);
  assert.deepEqual(game.recent, [], `${why}: repeat history`);
  assert.equal(game.gapsDone.size, 0, `${why}: gap bonuses`);
  assert.equal(game.hold, null, `${why}: hold`);
  assert.equal(game.tilt, 0, `${why}: seesaw tilt`);
  assert.equal(game.boomAt, null, `${why}: cop car blast`);
  assert.equal(game.bailReason, null);
  assert.equal(game.section, game.checkpoint.index);
  assert.deepEqual(camera(game), camera(ref), `${why}: camera`);
  // and the rider does ride on (no instant bail from a bad spawn)
  for (let t = 0; t < 0.25; t += STEP) game.update(STEP);
  assert.equal(game.phase, 'playing', `${why}: bailed again straight away (${game.bailReason})`);
}

// Bails after `t` seconds of free riding, in each of several ways.
for (const [st, i] of checkpoints) {
  test(`bail and retry: ${label(st, i)}, bailing while rolling at several points`, () => {
    for (const at of [0.02, 0.2, 0.45, 0.7, 1.0, 1.4, 2.0]) {
      const { game } = playUntil(st, i, [], (g, t) => t >= at);
      // riding with no input may bail on its own before `at` (the obstacle): a retry from there must work too
      bailAndRetry(game, st, i, `${label(st, i)} rolling ${at}s`, game.bailReason || 'slam');
    }
  });

  test(`bail and retry: ${label(st, i)}, bailing in the air and while charging`, () => {
    for (const at of [0.15, 0.4, 0.7]) {
      const air = playUntil(st, i, [[0.05, 'tap']], (g, t) => t >= at);
      bailAndRetry(air.game, st, i, `${label(st, i)} air ${at}s`, 'clipped');
      const charge = playUntil(st, i, [[0.02, 'cs'], [0.05, 'hold', 'down']], (g, t) => t >= at);
      bailAndRetry(charge.game, st, i, `${label(st, i)} charging ${at}s`, 'wall');
      const fl = playUntil(st, i, [[0.05, 'tap'], [0.2, 'hold']], (g, t) => t >= at);
      bailAndRetry(fl.game, st, i, `${label(st, i)} held in the air ${at}s`, 'flip');
    }
  });
}

// A manual and a grind are the states most likely to leave something behind.
test('bail and retry: out of a manual, from every checkpoint that has room to land one', () => {
  let n = 0;
  for (const [st, i] of checkpoints) {
    for (const dir of ['left', 'right']) {
      const run = playUntil(st, i, [[0.02, 'tap'], [0.1, 'hold', dir]], (g) => g.sk.manual && g.sk.manual.t > 0.15, 2.5);
      if (!run.game.sk.manual) continue; // nothing flat enough here (a rail or gap in the way)
      n++;
      const speedBefore = run.game.speed;
      assert.ok(speedBefore >= run.game.baseSpeed);
      bailAndRetry(run.game, st, i, `${label(st, i)} manual ${dir}`, 'slam');
    }
  }
  assert.ok(n >= 20, `only ${n} manual bails were exercised`);
});

test('bail and retry: out of a grind, on every rail', () => {
  let n = 0;
  for (const [st, i] of checkpoints) {
    // ollie at a sweep of times, hold to lock a grind, bail the moment one starts
    for (let t = 0.2; t < 1.6; t += 0.05) {
      const run = playUntil(st, i, [[t, 'tap'], [t, 'hold']], (g) => g.sk.mode === 'grind' && g.sk.grind, 3);
      if (run.game.sk.mode !== 'grind') continue;
      n++;
      assert.ok(run.game.sk.grind);
      bailAndRetry(run.game, st, i, `${label(st, i)} grind from tap ${t.toFixed(2)}`, 'clipped');
      break;
    }
  }
  assert.ok(n >= 15, `only ${n} grind bails were exercised`);
});

test('bail and retry: a bail after crossing into the next section restarts there, with the score banked so far', () => {
  for (const st of STAGES) {
    const secs = st.sections;
    for (let i = 0; i < secs.length - 1; i++) {
      const g = fresh(st, i, 50);
      g.tap();
      // teleport the rider just past the next section's edge, on the ground, and let it notice
      g.sk.x = secs[i + 1].x - 1;
      g.sk.y = g.groundAt(g.sk.x).y;
      g.update(STEP * 3);
      if (g.phase !== 'playing') continue; // fell into something right on the edge; nothing to check
      assert.equal(g.checkpoint.index, i + 1, `${st.id} section ${i + 1} -> ${i + 2}`);
      bailAndRetry(g, st, i + 1, `${st.id} crossing into ${i + 2}`, 'slam');
    }
  }
});

test('restarting the whole stage from the bail screen starts at checkpoint 1 with no score', () => {
  for (const st of STAGES) {
    const g = fresh(st, 3, 777);
    g.tap();
    g.bail('slam');
    g.restartStage();
    assert.equal(g.phase, 'playing');
    assert.equal(g.score, 0);
    assert.equal(g.checkpoint.index, 0);
    assert.equal(g.sk.x, st.sections[0].x + (st.sections[0].start ?? PHYS.START_X));
    assert.equal(g.sk.mode, 'roll');
  }
});

// ---- every checkpoint can be cleared from its restart point

// Searches the inputs that clear a checkpoint: a plain tap at some time, a charged
// ollie released at some time, or two taps. Returns how long (seconds) the
// widest run of working single-input timings is (the player's timing window).
function clears(st, i, acts) {
  const g = fresh(st, i);
  g.tap();
  const last = i === st.sections.length - 1;
  const goal = last ? st.width - 40 : st.sections[i + 1].x + 150;
  const q = [...acts].sort((a, b) => a[0] - b[0]);
  let t = 0;
  while (t < 9 && g.phase === 'playing') {
    while (q.length && q[0][0] <= t + 1e-9) {
      const [, k] = q.shift();
      if (k === 'tap') g.tap();
      else if (k === 'hold') g.setHold(true);
      else if (k === 'cs') g.startCharge();
      else if (k === 'cr') g.releaseCharge();
    }
    g.update(STEP);
    t += STEP;
    if (g.sk.x > goal && g.sk.mode === 'roll') return true;
  }
  return g.phase === 'complete';
}

const MIN_WINDOW = 0.06; // seconds: a timing window of at least this is needed to call a checkpoint fair

for (const st of STAGES) {
  sectionsOf(st).forEach((sec, i) => {
    test(`playable: ${label(st, i)} can be cleared from its restart point, with a fair timing window`, () => {
      const windows = [];
      const sweep = (make, step, to) => {
        let ok = 0;
        let best = 0;
        for (let t = 0; t < to; t += step) {
          if (clears(st, i, make(t))) best = Math.max(best, ++ok * step);
          else ok = 0;
        }
        return best;
      };
      windows.push(sweep((t) => [[t, 'tap']], 0.01, 2.8)); // a plain ollie (or a roll-off the edge)
      windows.push(sweep((t) => [[0, 'cs'], [t, 'cr']], 0.01, 1.6)); // a charged ollie
      // two inputs: ollie, then a tap in the air, or ollie-and-hold to grind
      for (let a = 0.1; a < 1.4; a += 0.05) {
        for (const d of [0.15, 0.3, 0.45, 0.6, 0.8, 1.0, 1.2]) {
          if (clears(st, i, [[a, 'tap'], [a + d, 'tap']])) windows.push(1);
        }
        if (clears(st, i, [[a, 'tap'], [a, 'hold']])) windows.push(1);
      }
      const best = Math.max(...windows);
      assert.ok(best >= MIN_WINDOW, `${label(st, i)}: no way to clear it (best timing window ${best.toFixed(2)} s)`);
    });
  });
}

// A trick banked earlier in the attempt (score, repeat history, gap bonuses) must not
// follow the rider back to the checkpoint.
test('bail and retry: after banking a trick, the retry starts with the checkpoint score and a clean slate', () => {
  let n = 0;
  for (const [st, i] of checkpoints) {
    const run = playUntil(st, i, [[0.02, 'tap'], [0.25, 'tap']], (g, t) => t > 0.5 && g.recent.length > 0, 3);
    if (!run.game.recent.length) continue;
    n++;
    assert.ok(run.game.score > SCORE, 'the trick banked');
    bailAndRetry(run.game, st, i, `${label(st, i)} after a banked trick`, 'slam');
  }
  assert.ok(n >= 10, `only ${n} checkpoints banked a trick before the bail`);
});
