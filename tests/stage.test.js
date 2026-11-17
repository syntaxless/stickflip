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
  [[0.7, 'tap'], [0.7, 'hold'], [1.74, 'up'], [4.66, 'tap'], [4.66, 'hold'], [7.16, 'up']], // Quarter Pipe (a replay starts on the Euro Gap top: roll off the lip, land, ollie onto the rail)
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

test('stage 1: the quarter pipe is the finale, ridden back out to the left', () => {
  const { game } = ride(6, CLEARS[6], () => false);
  assert.equal(game.phase, 'complete', `bailed: ${game.bailReason}`);
  assert.equal(game.sk.dir, -1);
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

test('stage 2 is Curb, Step Up, Trash Can and Ring of Fire', () => {
  assert.deepEqual(
    stage2.sections.map((s) => s.name),
    ['Curb', 'Step Up', 'Trash Can', 'Ring of Fire'],
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

function chargedRing(t) {
  const game = new Game(STAGES[1], null, { index: 3, score: 0 });
  game.tap();
  game.setHold(true);
  game.startCharge();
  const tricks = new Set();
  let up = false;
  for (let now = 0; now < 10 && game.phase === 'playing'; now += STEP) {
    if (!up && now >= t) {
      up = true;
      game.setHold(false);
      game.releaseCharge();
    }
    game.update(STEP);
    for (const e of game.drainEvents()) if (e.type === 'trick') tricks.add(e.name);
  }
  return { game, tricks };
}

test('ring of fire: a normal ollie passes under it with no bonus, none drops in the gap', () => {
  for (let t = 0.76; t <= 0.98; t += 0.02) {
    const { game, events } = ride2(3, [t]);
    assert.equal(game.phase, 'complete', `tap at ${t}: ${game.bailReason}`);
    assert.ok(!events.some((e) => e.type === 'trick' && e.name === 'RING OF FIRE'), `no bonus at ${t}`);
  }
  assert.equal(ride2(3, [0.5]).game.bailReason, 'gap', 'too early comes up short');
  assert.equal(ride2(3, []).game.phase, 'bailed', 'no ollie drops in the gap');
});

test('ring of fire: only a charged ollie gets through it, for the bonus', () => {
  for (const t of [0.66, 0.7, 0.72]) {
    const { game, tricks } = chargedRing(t);
    assert.equal(game.phase, 'complete', `charged at ${t}: ${game.bailReason}`);
    assert.ok(tricks.has('RING OF FIRE'), `charged at ${t}: ${[...tricks]}`);
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
  const clears = [[0.85, 1.8], [0.8], [0.5, 1.2], [1.05], [0.4, 0.95], [1.4], [0.9]];
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
  const clears = [[0.95], [], [0.9], [0.35, 0.9], [0.35, 0.9], [0.85], [0.85]];
  clears.forEach((taps, i) => {
    const game = ride4(i, taps, i === 1); // the slide is grinded: roll off the top with the finger held
    assert.ok(game.phase === 'complete' || (game.phase === 'playing' && game.section === i + 1), `${stage4.sections[i].name} bailed: ${game.bailReason}`);
  });
});

test('stage 4: the slide needs the finger held to grind it; the rest bail without an ollie', () => {
  assert.equal(ride4(1, []).bailReason, 'clipped');
  assert.equal(ride4(1, [], true).phase, 'playing');
  for (const i of [0, 2, 3, 4, 5, 6]) assert.equal(ride4(i, []).phase, 'bailed', stage4.sections[i].name);
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

test('the Mega Ramp is an all-wood night level', async () => {
  const { default: secret } = await import('../src/levels/secret.js');
  assert.equal(secret.wood, true);
  assert.equal(secret.night, true);
  assert.equal(secret.skyline, true);
});

test('stage 1: a Quarter Pipe replay has at least 0.6 s of runway to the rail, and the same inputs still clear it', () => {
  const sec = stage1.sections[6];
  const rail = sec.x + 220;
  const g = new Game(stage1, null, { index: 6, score: 0 });
  assert.ok((rail - g.sk.x) / 330 >= 0.6, `runway ${(rail - g.sk.x) / 330}s`);
  assert.ok(g.sk.x < sec.x, 'spawns back on the Euro Gap top, before the lip');
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
  assert.ok(sec.start < 0);
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
    while (t < 6 && g.phase === 'playing' && g.sk.x < sec + 900) {
      act(g, t, s);
      g.update(STEP);
      t += STEP;
    }
    return { g, s };
  };
  // route 1: roll off, land, tap
  const a = run((g, t, s) => { if (!s.d && t >= 1.4) { g.tap(); s.d = 1; } });
  assert.equal(a.g.phase, 'playing', `drop then ollie: ${a.g.bailReason}`);
  // route 2: hold to charge, let go on the platform before the edge
  const b = run((g, t, s) => {
    if (!s.c && t >= 0.05) { g.startCharge(); s.c = 1; }
    if (s.c && !s.r && t >= 0.8) { s.x = g.sk.x; g.releaseCharge(); s.r = 1; }
  });
  assert.equal(b.g.phase, 'playing', `charged ollie off the edge: ${b.g.bailReason}`);
  assert.ok(b.s.x < sec + 400, 'took off from the platform');
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
