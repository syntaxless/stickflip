import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { LEVELS } from '../src/levels/index.js';

const STEP = 1 / 120;

// Run a level with taps at the given times (seconds after the start tap).
function play(level, taps, maxTime = 8) {
  const game = new Game(level);
  game.tap(); // start rolling
  const queue = [...taps].sort((a, b) => a - b);
  const seen = new Set();
  let t = 0;
  while (t < maxTime && game.phase === 'playing') {
    while (queue.length && queue[0] <= t + 1e-9) {
      queue.shift();
      game.tap();
    }
    game.update(STEP);
    t += STEP;
    for (const e of game.drainEvents()) seen.add(e.type === 'trick' ? e.name : e.type);
  }
  return { game, seen };
}

const level1 = LEVELS[0];

test('every level has the fields the engine needs', () => {
  for (const lvl of LEVELS) {
    assert.ok(lvl.id && lvl.name && lvl.hint);
    assert.ok(lvl.obstacles.length >= 1);
    for (const o of lvl.obstacles) {
      assert.ok(Array.isArray(o.surfaces) && Array.isArray(o.solids));
      assert.equal(typeof o.draw, 'function');
    }
  }
});

test('doing nothing slams into the rail', () => {
  const { game } = play(level1, []);
  assert.equal(game.phase, 'bailed');
  assert.equal(game.bailReason, 'slam');
});

test('ollie onto the rail without a grind tap clips it', () => {
  const { game } = play(level1, [0.9]);
  assert.equal(game.phase, 'bailed');
  assert.equal(game.bailReason, 'clipped');
});

test('ollie then a late tap locks a grind and finishes the level', () => {
  const { game, seen } = play(level1, [0.9, 1.4]);
  assert.ok(seen.has('grind'));
  assert.equal(game.phase, 'complete');
  assert.ok(game.score > 300, `score ${game.score}`);
  assert.equal(game.stars, 1);
});

test('kickflip into the grind scores a 2x combo', () => {
  const { game, seen } = play(level1, [0.9, 0.92, 1.32]);
  assert.ok(seen.has('KICKFLIP') && seen.has('grind'));
  assert.equal(game.phase, 'complete');
  assert.equal(game.stars, 2);
});

test('kickflip in, grind, pop and kickflip out gets three stars', () => {
  const { game } = play(level1, [0.9, 0.92, 1.32, 2.3, 2.35]);
  assert.equal(game.phase, 'complete', `bailed: ${game.bailReason}`);
  assert.equal(game.stars, 3, `score ${game.score}`);
});

test('a tap during a flip is buffered and primes the grind', () => {
  // second and third taps both land during the flip; the buffered one primes.
  const { game, seen } = play(level1, [0.9, 1.0, 1.2]);
  assert.ok(seen.has('prime'));
  assert.equal(game.phase, 'complete');
});

test('flipping too late before the ground is a bail', () => {
  // Ollie early so the arc lands before the rail, flip right before landing.
  const { game } = play(level1, [0.2, 0.85]);
  assert.equal(game.phase, 'bailed');
  assert.equal(game.bailReason, 'flip');
});

test('retry after a bail restarts the run', () => {
  const { game } = play(level1, []);
  game.tap(); // too soon, ignored
  assert.equal(game.phase, 'bailed');
  for (let i = 0; i < 120; i++) game.update(STEP);
  game.tap();
  assert.equal(game.phase, 'playing');
  assert.equal(game.score, 0);
});
