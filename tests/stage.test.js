import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { STAGES } from '../src/stages/index.js';

const STEP = 1 / 120;
const stage1 = STAGES[0];

// The inputs that clear each original level on its own (see game.test.js),
// replayed on its section of the stage: the sections ride the same.
const CLEARS = [
  [[0.95, 'tap']], // First Rock
  [[1.0, 'tap']], // First Gap
  [[0.75, 'tap'], [1.32, 'tap']], // First Rail: ollie, lock a 50-50
  [[0.95, 'tap']], // Five Stair: ollie the set
  [[0.9, 'tap']], // Bank to Bank
  [[1.1, 'tap']], // Euro Gap
  [[0.3, 'tap'], [0.3, 'hold'], [1.34, 'up']], // Quarter Pipe (a replay starts on the street right after the Euro Gap: ollie onto the rail)
];

// Plays from checkpoint `index` with `acts`, until `until(game)` or 12 s.
function ride(index, acts, until) {
  const game = new Game(stage1, null, { index, score: 0 });
  game.tap();
  const queue = [...acts];
  const events = [];
  let t = 0;
  while (t < 12 && game.phase === 'playing' && !until(game)) {
    while (queue.length && queue[0][0] <= t + 1e-9) {
      const [, act] = queue.shift();
      if (act === 'tap') game.tap();
      else if (act === 'hold') game.setHold(true);
      else if (act === 'up') game.setHold(false);
    }
    game.update(STEP);
    t += STEP;
    events.push(...game.drainEvents());
  }
  return { game, events };
}

test('stage 1 is the rock and the six levels, one after another, as named checkpoints', () => {
  assert.deepEqual(
    stage1.sections.map((s) => s.name),
    ['First Rock', 'First Gap', 'First Rail', 'Five Stair', 'Bank to Bank', 'Euro Gap', 'Quarter Pipe'],
  );
  assert.equal(stage1.width, 7 * 960);
});

for (let i = 0; i < CLEARS.length - 1; i++) {
  test(`stage 1: section ${i + 1} rides on into section ${i + 2} (and lands any join)`, () => {
    const next = stage1.sections[i + 1].x;
    const { game, events } = ride(i, CLEARS[i], (g) => g.sk.x > next + 150 && g.sk.mode === 'roll');
    assert.equal(game.phase, 'playing', `bailed: ${game.bailReason} at x ${Math.round(game.sk.x)}`);
    const cp = events.filter((e) => e.type === 'checkpoint');
    assert.deepEqual(cp.map((e) => e.index), [i + 1]);
    assert.equal(game.checkpoint.index, i + 1);
  });
}

test('stage 1: the quarter pipe is the finale, the stage ends once the rider has ridden down the curve', () => {
  const { game } = ride(6, CLEARS[6], () => false);
  assert.equal(game.phase, 'complete', `bailed: ${game.bailReason}`);
  assert.equal(game.sk.mode, 'roll', 'finished at the bottom of the curve');
  assert.equal(game.sk.dir, -1);
});

test('clouds drift behind stages 1 and 2 only', () => {
  assert.equal(stage1.clouds, true);
  assert.equal(STAGES[1].clouds, true);
  for (const s of STAGES.slice(2)) assert.ok(!s.clouds, s.id);
});

test('a bail replays from the last checkpoint, with the score banked before it', () => {
  const game = new Game(stage1, null, { index: 3, score: 1234 });
  assert.equal(game.score, 1234);
  assert.equal(game.sk.x, stage1.sections[3].x + 80);
  game.tap();
  for (let i = 0; i < 1200 && game.phase === 'playing'; i++) game.update(STEP); // no ollie: bails on the stairs
  assert.equal(game.phase, 'bailed');
  game.phaseTime = 10;
  game.tap();
  assert.equal(game.phase, 'playing');
  assert.equal(game.section, 3);
  assert.equal(game.score, 1234);
  assert.equal(game.sk.x, stage1.sections[3].x + 80);
});

test('restarting the stage goes back to the first section with no score', () => {
  const game = new Game(stage1, null, { index: 4, score: 900 });
  game.restartStage();
  assert.equal(game.section, 0);
  assert.equal(game.score, 0);
  assert.equal(game.phase, 'playing');
});

// ------------------------------------------------------------ stage 2

const stage2 = STAGES[1];

function ride2(index, taps) {
  const game = new Game(stage2, null, { index, score: 0 });
  game.tap();
  const queue = [...taps];
  const events = [];
  const next = stage2.sections[index + 1]?.x ?? Infinity;
  let t = 0;
  while (t < 10 && game.phase === 'playing' && !(game.sk.x > next + 150 && game.sk.mode === 'roll')) {
    while (queue.length && queue[0] <= t + 1e-9) {
      queue.shift();
      game.tap();
    }
    game.update(STEP);
    t += STEP;
    events.push(...game.drainEvents());
  }
  return { game, events };
}

test('stage 2 is Curb, Step Up, Trash Can and Dumpster', () => {
  assert.deepEqual(
    stage2.sections.map((s) => s.name),
    ['Curb', 'Step Up', 'Trash Can', 'Dumpster'],
  );
});

test('stage 2: a timed ollie gets past each section', () => {
  for (const [i, t] of [[0, 0.8], [1, 1.0], [2, 0.9]]) {
    const { game } = ride2(i, [t]);
    assert.equal(game.phase, 'playing', `section ${i + 1} bailed: ${game.bailReason}`);
    assert.equal(game.section, i + 1);
  }
});

test('curb: hit its side and you slam; land on it and you roll along the top', () => {
  assert.equal(ride2(0, []).game.bailReason, 'slam');
  const { events } = ride2(0, [0.6]);
  assert.ok(events.some((e) => e.type === 'land' && e.y < 450), 'landed up on the curb');
});

test('trash can: no ollie slams, and the lid is no place to land', () => {
  assert.equal(ride2(2, []).game.bailReason, 'slam');
  const late = ride2(2, [1.1]).game;
  assert.equal(late.phase, 'bailed');
});

// Section 4 (the dumpster), ridden from its start. `mode`: 'tap' (a plain ollie),
// 'grind' (a tap with the finger held, to lock a grind) or 'charge' (a charged
// ollie released at t). Returns the game and the names of every trick and gap.
function ridePark(mode, t0) {
  const game = new Game(STAGES[1], null, { index: 3, score: 0 });
  game.tap();
  if (mode === 'charge') {
    game.setHold(true);
    game.startCharge();
  }
  const names = new Set();
  let done = false;
  for (let t = 0; t < 6 && game.phase === 'playing'; t += STEP) {
    if (!done && t >= t0) {
      done = true;
      if (mode === 'charge') {
        game.setHold(false);
        game.releaseCharge();
      } else {
        game.tap();
        if (mode === 'grind') game.setHold(true);
      }
    }
    game.update(STEP);
    for (const e of game.drainEvents()) if (e.type === 'trick' || e.type === 'gap') names.add(e.name);
  }
  return { game, names };
}

test('dumpster: rolling into it, or an ollie off the kicker too early, slams', () => {
  assert.equal(ride2(3, []).game.bailReason, 'slam');
  for (const t of [0.4, 0.46, 0.5]) assert.equal(ridePark('tap', t).game.bailReason, 'slam', `tap at ${t}`);
});

test('dumpster: a normal ollie lands on the lid and rolls off (0.56 to 0.82 s), or clears it for BIG LEAP (0.86 to 1.0 s)', () => {
  for (const t of [0.58, 0.7, 0.8]) {
    const { game, names } = ridePark('tap', t);
    assert.equal(game.phase, 'complete', `tap at ${t}: ${game.bailReason}`);
    assert.ok(!names.has('BIG LEAP'), `no leap at ${t}`);
  }
  for (const t of [0.86, 0.94, 1.0]) {
    const { game, names } = ridePark('tap', t);
    assert.equal(game.phase, 'complete', `tap at ${t}: ${game.bailReason}`);
    assert.ok(names.has('BIG LEAP'), `leap at ${t}: ${[...names]}`);
  }
  assert.equal(ridePark('tap', 1.1).game.bailReason, 'slam', 'too late slams into the side');
});

test('dumpster: a tap with the finger held locks a grind on the lid edge', () => {
  for (const t of [0.58, 0.7, 0.8]) {
    const { game, names } = ridePark('grind', t);
    assert.equal(game.phase, 'complete', `grind at ${t}: ${game.bailReason}`);
    assert.ok(names.has('50-50 GRIND'), `grind at ${t}: ${[...names]}`);
  }
});

test('dumpster: a charged ollie also clears it for BIG LEAP (0.68 to 0.86 s)', () => {
  for (const t of [0.68, 0.76, 0.84]) {
    const { game, names } = ridePark('charge', t);
    assert.equal(game.phase, 'complete', `charged at ${t}: ${game.bailReason}`);
    assert.ok(names.has('BIG LEAP'), `charged at ${t}: ${[...names]}`);
  }
});

test('curb: riding into it with the finger held is a slappy grind', () => {
  const game = new Game(STAGES[1], null, { index: 0, score: 0 });
  game.tap();
  game.setHold(true);
  const events = [];
  for (let t = 0; t < 4 && game.phase === 'playing' && game.section === 0; t += STEP) {
    game.update(STEP);
    events.push(...game.drainEvents());
  }
  assert.equal(game.phase, 'playing', `bailed: ${game.bailReason}`);
  assert.ok(events.some((e) => e.type === 'trick' && e.name === 'SLAPPY 50-50 GRIND'));
});

// ------------------------------------------------------------ stage 3

const stage3 = STAGES[2];

function ride3(index, taps) {
  const game = new Game(stage3, null, { index, score: 0 });
  game.tap();
  const queue = [...taps];
  const next = stage3.sections[index + 1]?.x ?? Infinity;
  for (let t = 0; t < 10 && game.phase === 'playing' && !(game.sk.x > next + 150 && game.sk.mode === 'roll'); t += STEP) {
    while (queue.length && queue[0] <= t + 1e-9) {
      queue.shift();
      game.tap();
    }
    game.update(STEP);
  }
  return game;
}

test('stage 3 is the construction site: seven checkpoints', () => {
  assert.deepEqual(
    stage3.sections.map((s) => s.name),
    ['Rock', 'Cone Row', 'Barrier Gap', 'Barricade', 'Scaffold Rail', 'Big Drop', 'Big Gap'],
  );
  assert.equal(stage3.id, 'stage-3');
});

test('stage 3: a timed ollie clears every checkpoint, and doing nothing bails', () => {
  const clears = [[0.85, 1.8], [0.8], [0.5, 1.45], [0.55, 1.5], [0.4, 0.95], [2.2], [0.9]];
  clears.forEach((taps, i) => {
    const game = ride3(i, taps);
    assert.ok(game.phase === 'complete' || (game.phase === 'playing' && game.section === i + 1), `${stage3.sections[i].name} bailed: ${game.bailReason}`);
    assert.equal(ride3(i, []).phase, 'bailed', `${stage3.sections[i].name} with no ollie`);
  });
});

test('rock: riding into it stops the board (a slam), a small ollie clears it', () => {
  assert.equal(ride3(0, []).bailReason, 'slam');
  assert.equal(ride3(0, [0.85, 1.8]).section, 1);
  assert.equal(ride3(0, [0.85]).bailReason, 'slam', 'the hydrant too');
});

// ------------------------------------------------------------ camera

test('the rider holds one spot on screen while the stage pans (no jitter)', async () => {
  const { Renderer } = await import('../src/render/renderer.js');
  const renderer = new Renderer({ w: 320, h: 180, ox: 0, oy: 0 });
  const game = new Game(STAGES[2]);
  game.tap();
  const offsets = new Set();
  for (let i = 0; i < 600; i++) {
    game.update(STEP);
    if (game.sk.mode === 'roll' && game.sk.x > 400) offsets.add(Math.round(game.sk.x / 3) - renderer.camera(game).x);
  }
  assert.equal(offsets.size, 1, `rider screen x varied: ${[...offsets]}`);
});

// ------------------------------------------------------------ stage 4

const stage4 = STAGES[3];

function ride4(index, taps, hold = false) {
  const game = new Game(stage4, null, { index, score: 0 });
  game.tap();
  if (hold) game.setHold(true);
  const queue = [...taps];
  const next = stage4.sections[index + 1]?.x ?? Infinity;
  for (let t = 0; t < 10 && game.phase === 'playing' && !(game.sk.x > next + 150 && game.sk.mode === 'roll'); t += STEP) {
    while (queue.length && queue[0] <= t + 1e-9) {
      queue.shift();
      game.tap();
    }
    game.update(STEP);
  }
  return game;
}

test('stage 4 is the playground: seven checkpoints', () => {
  assert.deepEqual(
    stage4.sections.map((s) => s.name),
    ['Toy Blocks', 'Slide', 'Sandbox', 'Seesaw', 'Monkey Bars', 'Block Tower', 'Ball Pit'],
  );
  assert.equal(stage4.id, 'stage-4');
});

test('stage 4: a timed ollie clears every checkpoint', () => {
  const clears = [[0.95], [0.5], null, [0.35, 0.9], [0.35, 0.9], [0.6], null]; // the sandbox and the ball pit need a charged ollie (below)
  clears.forEach((taps, i) => {
    if (!taps) return;
    const game = ride4(i, taps, i === 1); // the slide is grinded: ollie onto it with the finger held
    assert.ok(game.phase === 'complete' || (game.phase === 'playing' && game.section === i + 1), `${stage4.sections[i].name} bailed: ${game.bailReason}`);
  });
});

test('stage 4: the slide needs an ollie (with the finger held to lock the grind); every checkpoint bails without one', () => {
  for (const i of [0, 1, 2, 3, 4, 5, 6]) assert.equal(ride4(i, []).phase, 'bailed', stage4.sections[i].name);
  assert.equal(ride4(1, [], true).phase, 'bailed', 'holding with no ollie: you hit the platform');
  assert.equal(ride4(1, [0.5]).phase, 'bailed', 'an ollie without holding or tapping again clips the chute');
});

test('stage 4: the seesaw tips down to the ground under a grind, and springs back after', () => {
  const game = new Game(stage4, null, { index: 3, score: 0 });
  game.tap();
  const q = [0.35, 0.9];
  let maxTilt = 0;
  let lowest = 0;
  for (let t = 0; t < 5 && game.phase === 'playing'; t += STEP) {
    while (q.length && q[0] <= t + 1e-9) {
      q.shift();
      game.tap();
    }
    game.update(STEP);
    maxTilt = Math.max(maxTilt, game.tilt);
    if (game.sk.mode === 'grind') lowest = Math.max(lowest, game.sk.y);
  }
  assert.equal(maxTilt, 1);
  assert.ok(lowest > 440, `rode down to the street (${lowest})`);
  assert.equal(game.tilt, 0, 'the plank springs back once you are off');
});

// ------------------------------------------------------------ stage 5

const stage5 = STAGES[4];

function ride5(index, taps, hold = false) {
  const game = new Game(stage5, null, { index, score: 0 });
  game.tap();
  const queue = [...taps];
  const next = stage5.sections[index + 1]?.x ?? Infinity;
  for (let t = 0; t < 10 && game.phase === 'playing' && !(game.sk.x > next + 150 && game.sk.mode === 'roll'); t += STEP) {
    while (queue.length && queue[0] <= t + 1e-9) {
      queue.shift();
      game.tap();
      if (hold) game.setHold(true); // finger down: lock the grind on a rail
    }
    game.update(STEP);
  }
  return game;
}

test('stage 5 is the skate park: seven checkpoints', () => {
  assert.deepEqual(
    stage5.sections.map((s) => s.name),
    ['Ledges', 'Flat Bar', 'Hubba', 'Curb Cut', 'Fun Box', 'Big Set', 'Cop Car'],
  );
  assert.equal(stage5.id, 'stage-5');
});

test('stage 5: a timed ollie clears every checkpoint', () => {
  const clears = [[0.3, 1.3], [0.35, 0.9], [0.8], [], [0.8], [0.8], [0.85]];
  clears.forEach((taps, i) => {
    const game = ride5(i, taps, i === 4); // the long fun box rail is a grind: hold to lock it
    assert.ok(game.phase === 'complete' || (game.phase === 'playing' && game.section === i + 1), `${stage5.sections[i].name} bailed: ${game.bailReason}`);
  });
});

test('stage 5: the curb cut is a free ride, the rest bail without an ollie', () => {
  assert.notEqual(ride5(3, []).phase, 'bailed');
  for (const i of [0, 1, 2, 4, 5, 6]) {
    if (i === 4) continue; // the fun box can be ridden over with no ollie
    assert.equal(ride5(i, []).phase, 'bailed', stage5.sections[i].name);
  }
});

test('stage 1: the rock stops a board that never ollies, and the pool splashes a short jump', () => {
  const rockless = ride(0, [], () => false);
  assert.equal(rockless.game.phase, 'bailed');
  assert.equal(rockless.game.bailReason, 'slam');
  const swim = ride(4, [[0.9, 'tap']].map(([t, a]) => [t - 0.3, a]), () => false);
  assert.equal(swim.game.phase, 'bailed');
  assert.equal(stage1.sections[4].name, 'Bank to Bank');
  assert.ok(stage1.obstacles.some((o) => o.type === 'water'));
});

test('the tester quick-jump menu is gated to /unstable and localhost, like ?level=', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(src, /function setupTestMenu\(\) \{\n  if \(!\(IS_LOCAL \|\| IS_UNSTABLE\)\) return;/);
  assert.match(src, /const IS_LOCAL = !NATIVE && /);
});

test('water and dirt regions are moved into strip coordinates with their section', () => {
  const pool = stage1.obstacles.find((o) => o.splash);
  assert.equal(pool.splash.x1, 4 * 960 + 380);
  const patch = stage1.obstacles.find((o) => o.dirt);
  assert.equal(patch.dirt.x1, 960 + 430);
});

test('stage 1: an ollie off the top of the Euro Gap lands on the Quarter Pipe rail', () => {
  const game = new Game(stage1, null, { index: 5, score: 0 });
  game.tap();
  const q = [1.1, 1.75, 2.6, 3.3];
  const seen = new Set();
  const x6 = stage1.sections[6].x;
  for (let t = 0; t < 5 && game.phase === 'playing'; t += STEP) {
    while (q.length && q[0] <= t + 1e-9) {
      q.shift();
      game.tap();
    }
    game.update(STEP);
    for (const e of game.drainEvents()) if (e.type === 'grind' && e.x > x6) seen.add('grind');
  }
  assert.ok(seen.has('grind'), `no grind on the rail (${game.phase} ${game.bailReason})`);
  assert.equal(game.phase, 'playing');
});

test('stage 5: an ollie off the wooden ramp can land on the cop car\'s light bar and grind it', () => {
  const game = new Game(stage5, null, { index: 6, score: 0 });
  game.tap();
  const q = [0.65, 1.2];
  const x6 = stage5.sections[6].x;
  let grinded = false;
  for (let t = 0; t < 8 && game.phase === 'playing'; t += STEP) {
    while (q.length && q[0] <= t + 1e-9) {
      q.shift();
      game.tap();
    }
    game.update(STEP);
    if (game.sk.mode === 'grind' && game.sk.x > x6) grinded = true;
  }
  assert.ok(grinded, 'grinded the light bar');
  assert.equal(ride5(6, []).bailReason, 'slam', 'rolling into the car slams');
});

test('the Mega Ramp is an all-wood morning level', async () => {
  const { default: secret } = await import('../src/levels/secret.js');
  assert.equal(secret.wood, true);
  assert.equal(secret.morning, true);
  assert.equal(secret.skyline, true);
});

test('stage 1: a Quarter Pipe replay has at least 0.6 s of runway to the rail, and the same inputs still clear it', () => {
  const sec = stage1.sections[6];
  const rail = sec.x + 220;
  const g = new Game(stage1, null, { index: 6, score: 0 });
  assert.ok((rail - g.sk.x) / 330 >= 0.6, `runway ${(rail - g.sk.x) / 330}s`);
  assert.ok(g.sk.x >= sec.x, 'spawns on the street, right after the Euro Gap');
  const { game } = ride(6, CLEARS[6], (gm) => gm.sk.x > sec.x + 700 && gm.sk.dir > 0 && gm.sk.mode !== 'grind');
  assert.equal(game.phase, 'playing', `bailed: ${game.bailReason}`);
});

test('stage 1: a Quarter Pipe replay can be cleared by a rail tap anywhere in a window over 0.5 s wide', () => {
  const sec = stage1.sections[6];
  const clears = (at) => {
    const g = new Game(stage1, null, { index: 6, score: 0 });
    g.tap();
    let t = 0;
    let tapped = false;
    let grinding = false;
    while (t < 2.6 && g.phase === 'playing') {
      if (!tapped && t >= at) {
        g.tap();
        g.setHold(true);
        tapped = true;
      }
      g.update(STEP);
      t += STEP;
      if (g.sk.mode === 'grind') grinding = true;
    }
    return grinding && g.phase === 'playing';
  };
  const ok = [];
  for (let at = 0.02; at < 1.6; at += 0.02) if (clears(at)) ok.push(at);
  assert.ok(ok.length && ok[ok.length - 1] - ok[0] > 0.5, `window ${ok[0]}..${ok[ok.length - 1]}`);
  assert.equal(sec.start, 0);
});

test('stage 5: the Big Set is three concrete steps with no rail to grind', () => {
  const set = stage5.obstacles.find((o) => o.type === 'concrete-set');
  assert.ok(set);
  assert.equal(set.surfaces.length, 0);
  assert.equal(set.ground.filter((s) => s.bail === 'stairs').length, 2);
});

test('stage 5: the curb cut is a dip cut into the ground, and the fun box is longer than before', () => {
  const cut = stage5.obstacles.find((o) => o.type === 'curb-cut');
  const lowest = Math.max(...cut.ground.map((s) => Math.max(s.y1 ?? s.y, s.y2 ?? s.y)));
  assert.ok(lowest > 450, 'the driveway sits below street level');
  assert.ok(cut.ground.every((s) => !s.under), 'not a bump laid on top of the ground');
  const box = stage5.obstacles.find((o) => o.type === 'fun-box');
  const [x1, x2] = [Math.min(...box.ground.map((s) => s.x1)), Math.max(...box.ground.map((s) => s.x2))];
  assert.ok(x2 - x1 > 410 && x2 - x1 <= 500, `fun box ${x2 - x1} wide (longer than before, within a full charge)`);
});

test('stage 5: a fully charged ollie clears the whole fun box (it is no longer than that)', () => {
  const sec = stage5.sections[4].x;
  const box = stage5.obstacles.find((o) => o.type === 'fun-box');
  const end = Math.max(...box.ground.map((s) => s.x2));
  let clears = 0;
  for (let h0 = 0; h0 < 0.6; h0 += 0.02) {
    const g = new Game(stage5, null, { index: 4, score: 0 });
    g.tap();
    let t = 0;
    let started = false;
    let released = false;
    let wasAir = false;
    let landed = null;
    while (t < 5 && g.phase === 'playing' && landed === null && g.sk.x < end + 100) {
      if (!started && t >= h0) started = g.startCharge() || true;
      if (started && !released && t >= h0 + 0.75) released = g.releaseCharge() || true;
      g.update(STEP);
      t += STEP;
      if (g.sk.mode === 'air') wasAir = true;
      else if (wasAir && released) landed = g.sk.x;
    }
    if (g.phase === 'playing' && landed !== null && landed >= end) clears++;
  }
  assert.ok(clears >= 6, `${clears} charge timings clear a ${end - Math.min(...box.ground.map((s) => s.x1))}-wide box`);
});

test('stage 3: the Big Drop has two routes: land and ollie the barrel, or one charged ollie off the edge over both', () => {
  const sec = stage3.sections[5].x;
  const run = (act) => {
    const g = new Game(stage3, null, { index: 5, score: 0 });
    g.tap();
    const s = {};
    let t = 0;
    while (t < 6 && g.phase === 'playing' && g.sk.x < sec + 1000) {
      act(g, t, s);
      g.update(STEP);
      t += STEP;
    }
    return { g, s };
  };
  // route 1: roll off, land, tap
  const a = run((g, t, s) => { if (!s.d && t >= 2.2) { g.tap(); s.d = 1; } });
  assert.equal(a.g.phase, 'playing', `drop then ollie: ${a.g.bailReason}`);
  // route 2: hold to charge, let go on the platform before the edge
  const b = run((g, t, s) => {
    if (!s.c && t >= 0.05) { g.startCharge(); s.c = 1; }
    if (s.c && !s.r && t >= 1.3) { s.x = g.sk.x; g.releaseCharge(); s.r = 1; }
  });
  assert.equal(b.g.phase, 'playing', `charged ollie off the edge: ${b.g.bailReason}`);
  assert.ok(b.s.x < sec + 550, 'took off from the platform');
});

test('stage 1: the First Gap is gravel and the Euro Gap is concrete (looks only, same physics)', () => {
  assert.equal(stage1.obstacles.find((o) => o.type === 'dirt-gap').dirt.kind, 'gravel');
  const euro = stage1.obstacles.filter((o) => o.ground.some((s) => s.material === 'concrete'));
  assert.ok(euro.length >= 3, 'the bank, the lip and the stairs are concrete');
});

test('stage 3: the Big Drop platform and its ramp up are concrete', () => {
  const concrete = stage3.obstacles.filter((o) => o.ground.some((s) => s.material === 'concrete'));
  assert.ok(concrete.length >= 3, 'the ramp, its flat and the platform');
});

// ------------------------------------------------------------ level tweaks (stages 3 and 4)

// Plays a checkpoint with a custom driver, `act(game, t)`, until the next section's roll or 8 s.
function drive(stage, index, act) {
  const game = new Game(stage, null, { index, score: 0 });
  game.tap();
  const next = stage.sections[index + 1]?.x ?? Infinity;
  for (let t = 0; t < 8 && game.phase === 'playing' && !(game.sk.x > next + 150 && game.sk.mode === 'roll'); t += STEP) {
    act(game, t);
    game.update(STEP);
  }
  return game;
}

test('stage 4: the sandbox is too wide for a normal ollie; a fully charged one clears it, in a window over 0.15 s', () => {
  const plain = drive(stage4, 2, (g, t) => { if (!g.sk.did && t >= 0.8) { g.tap(); g.sk.did = 1; } });
  assert.equal(plain.phase, 'bailed', 'a plain ollie falls in');
  for (let at = 0.5; at < 1.0; at += 0.02) {
    const g = drive(stage4, 2, (gm, t) => { if (!gm.sk.did && at < 0.9 && t >= at) { gm.tap(); gm.sk.did = 1; } });
    if (g.phase === 'playing' || g.phase === 'complete') assert.fail(`a plain ollie at ${at} cleared the sandbox`);
  }
  const clears = (hold) => {
    const g = drive(stage4, 2, (gm, t) => {
      if (!gm.sk.s) { gm.startCharge(); gm.sk.s = 1; }
      if (!gm.sk.r && t >= hold) { gm.releaseCharge(); gm.sk.r = 1; }
    });
    return g.phase === 'complete' || g.phase === 'playing';
  };
  const ok = [];
  for (let h = 0.3; h < 1.2; h += 0.01) if (clears(h)) ok.push(h);
  assert.ok(ok.length && ok[ok.length - 1] - ok[0] > 0.15, `charged window ${ok[0]}..${ok[ok.length - 1]}`);
  const sand = stage4.obstacles.find((o) => o.type === 'gap' || o.ground.some((s) => s.bail === 'gap' && s.x2 - s.x1 > 200));
  assert.ok(sand.ground[0].x2 - sand.ground[0].x1 >= 260, 'wider than a plain ollie flies (about 240)');
});

test('stage 4: the ball pit (320 wide, after a kicker) takes a fully charged ollie off the lip; a plain one drops you in', () => {
  for (let at = 0.5; at < 1.1; at += 0.02) {
    const g = drive(stage4, 6, (gm, t) => { if (!gm.sk.did && t >= at) { gm.tap(); gm.sk.did = 1; } });
    assert.equal(g.phase, 'bailed', `a plain ollie at ${at}`);
  }
  const ok = [];
  for (let h = 0.4; h < 1.2; h += 0.01) {
    const g = drive(stage4, 6, (gm, t) => {
      if (!gm.sk.s) { gm.startCharge(); gm.sk.s = 1; }
      if (!gm.sk.r && t >= h) { gm.releaseCharge(); gm.sk.r = 1; }
    });
    if (g.phase === 'complete' || g.phase === 'playing') ok.push(h);
  }
  assert.ok(ok.length && ok[ok.length - 1] - ok[0] > 0.15, `charged window ${ok[0]}..${ok[ok.length - 1]}`);
});

test('stage 3: the Barricade takes two jumps (two sawhorses with room to land between)', () => {
  const horses = stage3.sections[3] && stage3.obstacles.filter((o) => o.type === 'sawhorse' && o.solids.length);
  const here = horses.filter((o) => o.solids[0].x >= stage3.sections[3].x && o.solids[0].x < stage3.sections[4].x);
  assert.equal(here.length, 2);
  assert.ok(here[1].solids[0].x - (here[0].solids[0].x + here[0].solids[0].w) >= 200, 'room to land and pop again');
  assert.equal(ride3(3, [0.6]).phase, 'bailed', 'one jump is not enough');
  assert.equal(ride3(3, [0.55, 1.5]).phase === 'bailed', false);
});

test('stage 3: the Barrier Gap barrier is longer, and the Big Drop sits farther from the scaffold rail', () => {
  const barrier = stage3.obstacles.find((o) => o.type === 'barrier');
  assert.ok(barrier.solids[0].w >= 300);
  const rail = stage3.obstacles.find((o) => o.type === 'scaffold');
  const ramp = stage3.obstacles.filter((o) => o.type === 'bank' && o.ground[0].y1 === 450 && o.ground[0].y2 < 450).find((o) => o.ground[0].x1 > 4 * 960);
  const railEnd = Math.max(...rail.surfaces.map((s) => s.x2));
  assert.ok(ramp.ground[0].x1 - railEnd >= 300, `${ramp.ground[0].x1 - railEnd} of street between the rail and the ramp`);
});

test('stage 3: the Big Gap kicker is a broken slab of concrete and the gap is filled with rubble', () => {
  const slab = stage3.obstacles.find((o) => o.type === 'broken-slab');
  assert.equal(slab.ground[0].material, 'concrete');
  assert.equal(stage3.obstacles.find((o) => o.type === 'broken-gap').dirt.kind, 'rubble');
});

test('stage 4: the slide is a tall platform with a chute curving out flat at the bottom, no ladder or ramp up; the window to ollie on is over 0.35 s', () => {
  const slide = stage4.obstacles.find((o) => o.type === 'slide');
  assert.ok(slide);
  assert.ok(!stage4.obstacles.some((o) => o.type === 'slide-ladder' || (o.type === 'bank' && o.ground[0].x1 > 960 && o.ground[0].x1 < 1920)));
  const chute = slide.surfaces.find((x) => x.grindable);
  assert.ok(chute.y2 > chute.y1, 'slopes down');
  const lip = slide.surfaces.find((x) => !x.grindable && x.y > chute.y2);
  assert.ok(lip, 'a flat lip at the bottom of the curve');
  const clears = (at) => {
    const g = new Game(stage4, null, { index: 1, score: 0 });
    g.tap();
    let t = 0;
    let done = false;
    while (t < 5 && g.phase === 'playing' && g.sk.x < stage4.sections[2].x + 200) {
      if (!done && t >= at) { g.tap(); g.setHold(true); done = true; }
      g.update(STEP);
      t += STEP;
    }
    return g.phase === 'playing';
  };
  const ok = [];
  for (let at = 0; at < 1.6; at += 0.02) if (clears(at)) ok.push(at);
  assert.ok(ok.length && ok[ok.length - 1] - ok[0] > 0.35, `window ${ok[0]}..${ok[ok.length - 1]}`);
});

test('stage 4: the block tower is a stack of three toy blocks, one tall solid with a landable top', () => {
  const tower = stage4.obstacles.find((o) => o.type === 'block-tower');
  assert.equal(tower.ground.length, 0, 'no stair steps');
  assert.equal(tower.solids.length, 1);
  assert.ok(tower.solids[0].h >= 90 && tower.surfaces[0].landable);
});

// ------------------------------------------------------------ the cop car

test('stage 5: grinding the cop car light bar blows it up once the grind is over; the rider is fine and SIREN GRIND still scores', () => {
  const car = stage5.obstacles.find((o) => o.type === 'cop-car');
  const barX = car.surfaces[0];
  const sec = 6;
  let found = null;
  for (let at = 0.3; at < 1.6 && !found; at += 0.02) {
    const g = new Game(stage5, null, { index: sec, score: 0 });
    g.tap();
    let t = 0;
    let did = false;
    const names = [];
    let boomAtX = null;
    while (t < 6 && g.phase === 'playing') {
      if (!did && t >= at) { g.tap(); g.setHold(true); did = true; }
      g.update(STEP);
      t += STEP;
      for (const e of g.drainEvents()) {
        if (e.type === 'gap') names.push(e.name);
        if (e.type === 'boom') boomAtX = g.sk.x;
      }
      if (boomAtX !== null && t > 2) break;
    }
    if (boomAtX !== null) found = { g, names, boomAtX, at };
  }
  assert.ok(found, 'a grind of the light bar sets the blast off');
  assert.equal(found.g.phase, 'playing', 'the rider is not bailed or hurt');
  assert.ok(found.g.boomAt !== null);
  assert.ok(found.boomAtX >= barX.x2 - 6, 'it goes off after the grind is over, at the end of the bar');
  assert.ok(found.names.includes('SIREN GRIND'));
});

test('stage 5: ollieing over the cop car leaves it alone (no blast), and a restart makes it whole again', () => {
  let cleared = null;
  for (let at = 0.3; at < 1.6 && !cleared; at += 0.02) {
    const g = new Game(stage5, null, { index: 6, score: 0 });
    g.tap();
    let t = 0;
    let did = false;
    while (t < 6 && g.phase === 'playing' && g.sk.x < stage5.sections[6].x + 800) {
      if (!did && t >= at) { g.tap(); did = true; } // a plain ollie: no hold, so no grind
      g.update(STEP);
      t += STEP;
    }
    if (g.phase === 'playing' && g.sk.x > stage5.sections[6].x + 700) cleared = g;
  }
  assert.ok(cleared, 'a plain ollie clears the car');
  assert.equal(cleared.boomAt, null);
  cleared.boomAt = 1;
  cleared.reset();
  assert.equal(cleared.boomAt, null);
});

test('stage 5: the exploded cop car draws a wreck and flames without error, and the whole car before', () => {
  const car = stage5.obstacles.find((o) => o.type === 'cop-car');
  const frames = [null, 0, 0.05, 0.2, 0.4, 0.6, 1, 3, 8];
  for (const boom of frames) {
    const pix = new Set();
    const g = { fill: (...a) => pix.add(`f${a}`), rect: (...a) => pix.add(`r${a}`), line: (...a) => pix.add(`l${a}`), pset: (...a) => pix.add(`p${a}`), circle: (...a) => pix.add(`c${a}`), text() {} };
    car.draw(g, { time: 1.3, boom });
    assert.ok(pix.size > 20, `frame ${boom} drew`);
  }
});

// ------------------------------------------------- backgrounds in wide frames

// A recording framebuffer: rasterises fills into a width x height colour grid.
function gridFb(w, h) {
  const cells = new Array(w * h).fill(null);
  const fb = {
    w, h, ox: 0, oy: 0,
    fill(x, y, ww, hh, c) {
      for (let yy = y + fb.oy; yy < y + fb.oy + hh; yy++) for (let xx = x + fb.ox; xx < x + fb.ox + ww; xx++) if (xx >= 0 && xx < w && yy >= 0 && yy < h) cells[yy * w + xx] = c.join();
    },
    pset(x, y, c) { fb.fill(x, y, 1, 1, c); },
    line() {}, rect() {}, circle() {}, text() {}, clear() {},
  };
  fb.cells = cells;
  return fb;
}

test('backgrounds: sky layers in the wide frame behind the bars line up with the game picture (no cut at the game edge)', async () => {
  const { Renderer } = await import('../src/render/renderer.js');
  const rd = new Renderer(gridFb(320, 180));
  rd.time = 4.2;
  for (const lvl of [{ clouds: true }, { skyline: true }, { skyline: true, morning: true }]) {
    for (const camX of [0, 977, 2400]) {
      const game = { level: lvl };
      const main = gridFb(320, 180);
      rd.drawSkyline(main, game, { x: camX, y: 0 });
      for (const left of [0, 40, 130]) {
        const wide = gridFb(320 + 2 * left, 180);
        rd.drawSkyline(wide, game, { x: camX - left, y: 0, px: camX, py: 0, left, top: 0 });
        for (let y = 0; y < 180; y++) for (let x = 0; x < 320; x++) {
          assert.equal(wide.cells[y * wide.w + x + left], main.cells[y * 320 + x], `${Object.keys(lvl)} cam ${camX} left ${left} at ${x},${y}`);
        }
      }
    }
  }
});

// ------------------------------------------- the cop and the Oslo sign

test('stage 5: the cop sits at the wheel (the driver side, on the right as you look at the car), and only after the blast does he jump out and run off right', () => {
  const car = stage5.obstacles.find((o) => o.type === 'cop-car');
  const [l, r] = [Math.round(450 / 3), Math.round(582 / 3) - 1];
  const skin = [255, 212, 165].join();
  const cops = (boom) => {
    const hits = [];
    const g = { fill: (x, y, w, h, c) => { if (c.join() === skin) hits.push([x, y, w, h]); }, rect() {}, line() {}, pset(x, y, c) { if (c.join() === skin) hits.push([x, y, 1, 1]); }, circle() {}, text() {} };
    car.draw(g, { time: 1.3, boom });
    return hits;
  };
  const whole = cops(null);
  assert.ok(whole.length && whole.every(([x]) => x > (l + r) / 2 && x < r), 'in the car, on the right half of the windscreen');
  assert.equal(cops(0.05).length, whole.length, 'still in the car as the blast goes off');
  let last = r - 20;
  for (const age of [0.3, 0.6, 1.0, 1.4]) {
    const c = cops(age);
    assert.ok(c.length > 0, `a cop outside the car at ${age}`);
    const x = Math.min(...c.map(([cx]) => cx));
    assert.ok(x > last, `running away to the right at ${age}`);
    last = x;
  }
  assert.ok(Math.min(...cops(1.4).map(([cx]) => cx)) > r + 30, 'well clear of the wreck');
});

test('stage 1: the Oslo City Limits sign sits just past the rock as decor only, and is gone from 2-2', () => {
  const stage1 = STAGES.find((s) => s.id === 'stage-1');
  assert.ok(!stage2.obstacles.some((o) => o.type === 'city-sign'), 'no sign left in stage 2');
  assert.equal(stage1.obstacles.filter((o) => o.type === 'city-sign').length, 1);
  const sign = stage1.obstacles.find((o) => o.type === 'city-sign');
  assert.equal(sign.surfaces.length + sign.solids.length + (sign.ground || []).length, 0);
  const g = { fill() {}, rect() {}, line() {}, pset() {}, circle() {}, text(s) { texts.push(s); } };
  const texts = [];
  sign.draw(g);
  assert.ok(texts.includes('OSLO') && texts.includes('CITY LIMITS'));
});

test('cop sprites: every row is the same width and every letter is in the palette; the car fills the 44 x 32 footprint', async () => {
  const { CAR_SPRITE, COP_SPRITES, SPRITE_PALETTE } = await import('../src/obstacles/cop-sprites.js');
  for (const rows of [CAR_SPRITE, ...Object.values(COP_SPRITES)]) {
    assert.ok(rows.every((r) => r.length === rows[0].length));
    for (const r of rows) for (const ch of r) assert.ok(ch === '.' || SPRITE_PALETTE[ch], `letter ${ch}`);
  }
  assert.equal(CAR_SPRITE.length, 32);
  assert.equal(CAR_SPRITE[0].length, 44);
});

test('dumpster: the lid stays shut until a grind starts on it, and a plain ollie never opens it', () => {
  const closed = ridePark('tap', 0.7).game;
  assert.equal(closed.openAt, null);
  assert.notEqual(ridePark('grind', 0.7).game.openAt, null);
});
