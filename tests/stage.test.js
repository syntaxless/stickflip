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
  [[0.4, 'tap'], [0.4, 'hold'], [1.5, 'up'], [4.0, 'tap'], [4.0, 'hold'], [6.5, 'up']], // Quarter Pipe
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

test('ring of fire: through it is a trick and finishes the stage; rolling off the kicker burns', () => {
  const { game, events } = ride2(3, [0.9]);
  assert.equal(game.phase, 'complete', `bailed: ${game.bailReason}`);
  assert.ok(events.some((e) => e.type === 'trick' && e.name === 'RING OF FIRE'));
  assert.equal(ride2(3, []).game.bailReason, 'fire', 'no ollie: feet in the flames');
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

test('ring of fire: a normal ollie through the middle of the window clears, early and late burn', () => {
  for (let t = 0.76; t <= 0.9; t += 0.02) {
    assert.equal(ride2(3, [t]).game.phase, 'complete', `tap at ${t}`);
  }
  assert.equal(ride2(3, [0.6]).game.bailReason, 'fire', 'too early');
  assert.equal(ride2(3, [1.1]).game.phase, 'bailed', 'too late');
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
    ['Rock', 'Cone Row', 'Barrier Gap', 'Barricade', 'Scaffold Rail', 'Big Set', 'Big Gap'],
  );
  assert.equal(stage3.id, 'stage-3');
});

test('stage 3: a timed ollie clears every checkpoint, and doing nothing bails', () => {
  const clears = [[0.85, 1.8], [0.8], [0.5, 1.2], [1.05], [0.4, 0.95], [0.9], [0.9]];
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

function ride4(index, taps) {
  const game = new Game(stage4, null, { index, score: 0 });
  game.tap();
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
    const game = ride4(i, taps);
    assert.ok(game.phase === 'complete' || (game.phase === 'playing' && game.section === i + 1), `${stage4.sections[i].name} bailed: ${game.bailReason}`);
  });
});

test('stage 4: the slide is a free ride, the rest bail without an ollie', () => {
  assert.notEqual(ride4(1, []).phase, 'bailed');
  for (const i of [0, 2, 3, 4, 5, 6]) assert.equal(ride4(i, []).phase, 'bailed', stage4.sections[i].name);
});

// ------------------------------------------------------------ stage 5

const stage5 = STAGES[4];

function ride5(index, taps) {
  const game = new Game(stage5, null, { index, score: 0 });
  game.tap();
  const queue = [...taps];
  const next = stage5.sections[index + 1]?.x ?? Infinity;
  for (let t = 0; t < 10 && game.phase === 'playing' && !(game.sk.x > next + 150 && game.sk.mode === 'roll'); t += STEP) {
    while (queue.length && queue[0] <= t + 1e-9) {
      queue.shift();
      game.tap();
    }
    game.update(STEP);
  }
  return game;
}

test('stage 5 is the skate park: seven checkpoints', () => {
  assert.deepEqual(
    stage5.sections.map((s) => s.name),
    ['Ledges', 'Flat Bar', 'Hubba', 'Bowl', 'Fun Box', 'Big Set', 'Final Gap'],
  );
  assert.equal(stage5.id, 'stage-5');
});

test('stage 5: a timed ollie clears every checkpoint', () => {
  const clears = [[0.3, 1.3], [0.35, 0.9], [0.85], [], [0.5, 1.0], [0.95], [0.85]];
  clears.forEach((taps, i) => {
    const game = ride5(i, taps);
    assert.ok(game.phase === 'complete' || (game.phase === 'playing' && game.section === i + 1), `${stage5.sections[i].name} bailed: ${game.bailReason}`);
  });
});

test('stage 5: the bowl is a free ride, the rest bail without an ollie', () => {
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

test('water and grass regions are moved into strip coordinates with their section', () => {
  const pool = stage1.obstacles.find((o) => o.water);
  assert.equal(pool.water.x1, 4 * 960 + 380);
  const patch = stage1.obstacles.find((o) => o.grass);
  assert.equal(patch.grass.x1, 960 + 430);
});
