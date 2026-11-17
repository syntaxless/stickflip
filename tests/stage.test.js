import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { STAGES } from '../src/stages/index.js';

const STEP = 1 / 120;
const stage1 = STAGES[0];

// The inputs that clear each original level on its own (see game.test.js),
// replayed on its section of the stage: the sections ride the same.
const CLEARS = [
  [[1.0, 'tap']], // First Gap
  [[0.75, 'tap'], [1.32, 'tap']], // First Rail: ollie, lock a 50-50
  [[0.95, 'tap']], // Five Stair: ollie the set
  [[0.9, 'tap']], // Bank to Bank
  [[1.1, 'tap']], // Euro Gap
  [[0.4, 'tap'], [0.4, 'hold'], [1.5, 'up'], [4.5, 'tap'], [4.5, 'hold'], [7, 'up']], // Quarter Pipe
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

test('stage 1 is the six levels, one after another, as named checkpoints', () => {
  assert.deepEqual(
    stage1.sections.map((s) => s.name),
    ['First Gap', 'First Rail', 'Five Stair', 'Bank to Bank', 'Euro Gap', 'Quarter Pipe'],
  );
  assert.equal(stage1.width, 6 * 960);
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
  const { game } = ride(5, CLEARS[5], () => false);
  assert.equal(game.phase, 'complete', `bailed: ${game.bailReason}`);
  assert.equal(game.sk.dir, -1);
});

test('a bail replays from the last checkpoint, with the score banked before it', () => {
  const game = new Game(stage1, null, { index: 2, score: 1234 });
  assert.equal(game.score, 1234);
  assert.equal(game.sk.x, stage1.sections[2].x + 80);
  game.tap();
  for (let i = 0; i < 1200 && game.phase === 'playing'; i++) game.update(STEP); // no ollie: bails on the stairs
  assert.equal(game.phase, 'bailed');
  game.phaseTime = 10;
  game.tap();
  assert.equal(game.phase, 'playing');
  assert.equal(game.section, 2);
  assert.equal(game.score, 1234);
  assert.equal(game.sk.x, stage1.sections[2].x + 80);
});

test('restarting the stage goes back to the first section with no score', () => {
  const game = new Game(stage1, null, { index: 3, score: 900 });
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

test('ring of fire: any ollie off the kicker goes through, tapped or charged', () => {
  for (let t = 0.875; t <= 1.126; t += 0.025) {
    assert.equal(ride2(3, [t]).game.phase, 'complete', `tap at ${t}`);
  }
  for (let t = 0.8; t <= 0.95; t += 0.025) {
    const game = new Game(STAGES[1], null, { index: 3, score: 0 });
    game.tap();
    game.setHold(true);
    game.startCharge();
    let up = false;
    for (let now = 0; now < 10 && game.phase === 'playing'; now += STEP) {
      if (!up && now >= t) {
        up = true;
        game.setHold(false);
        game.releaseCharge();
      }
      game.update(STEP);
    }
    assert.equal(game.phase, 'complete', `charged, let go at ${t}: ${game.bailReason}`);
  }
});
