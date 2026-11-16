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

const level1 = LEVELS[1]; // First Rail (these tests predate the gap level)

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
  const { game } = play(level1, [0.75]);
  assert.equal(game.phase, 'bailed');
  assert.equal(game.bailReason, 'clipped');
});

test('ollie then a late tap locks a grind and finishes the level', () => {
  const { game, seen } = play(level1, [0.75, 1.32]);
  assert.ok(seen.has('grind'));
  assert.equal(game.phase, 'complete');
  assert.ok(game.score > 250, `score ${game.score}`);
  assert.equal(game.stars, 1);
});

test('kickflip into the grind scores a 2x combo', () => {
  const { game, seen } = play(level1, [0.75, 0.77, 1.32]);
  assert.ok(seen.has('KICKFLIP') && seen.has('grind'));
  assert.equal(game.phase, 'complete');
  assert.equal(game.stars, 2);
});

test('kickflip in, grind, pop and kickflip out gets three stars', () => {
  const { game } = play(level1, [0.75, 0.77, 1.32, 1.8, 1.82]);
  assert.equal(game.phase, 'complete', `bailed: ${game.bailReason}`);
  assert.equal(game.stars, 3, `score ${game.score}`);
});

test('a tap during a flip is ignored, so the rail is clipped', () => {
  const { game, seen } = play(level1, [0.75, 0.77, 1.0]);
  assert.ok(!seen.has('prime'));
  assert.equal(game.bailReason, 'clipped');
});

test('tapping for the grind too early starts a kickflip that lands on the rail', () => {
  const { game } = play(level1, [0.75, 1.1]);
  assert.equal(game.phase, 'bailed');
  assert.equal(game.bailReason, 'flip');
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

// ------------------------------------------------------------ swipe tricks

// Like play(), but each input is [time, 'tap' | swipe direction].
function playInputs(level, inputs, maxTime = 8) {
  const game = new Game(level);
  game.tap();
  const queue = [...inputs].sort((a, b) => a[0] - b[0]);
  const names = [];
  let t = 0;
  while (t < maxTime && game.phase === 'playing') {
    while (queue.length && queue[0][0] <= t + 1e-9) {
      const [, input] = queue.shift();
      if (input === 'tap') game.tap();
      else game.swipe(input);
    }
    game.update(STEP);
    t += STEP;
    for (const e of game.drainEvents()) if (e.type === 'trick') names.push(e.name);
  }
  return { game, names };
}

test('swipes in the air do their tricks and still allow the grind', () => {
  for (const [dir, name] of [
    ['down', 'HEELFLIP'],
    ['up', 'POP SHOVE-IT'],
    ['right', 'FS 360'],
    ['left', 'BS 360'],
    ['down-right', '360 FLIP'],
    ['down-left', 'HARDFLIP'],
  ]) {
    const { game, names } = playInputs(level1, [[0.75, 'tap'], [0.77, dir], [1.36, 'tap']]);
    assert.ok(names.includes(name), `${dir} -> ${names}`);
    assert.equal(game.phase, 'complete', `${dir}: bailed ${game.bailReason}`);
  }
});

test('a swipe on the ground ollies and an unknown pattern falls back to its first direction', () => {
  const { game, names } = playInputs(level1, [[0.75, 'right'], [0.77, 'down-up'], [1.32, 'tap']]);
  assert.ok(names.includes('HEELFLIP'), String(names));
  assert.equal(game.phase, 'complete');
});

test('a long trick started too late is a bail', () => {
  const { game } = playInputs(level1, [[0.2, 'tap'], [0.75, 'down-right']]);
  assert.equal(game.phase, 'bailed');
  assert.equal(game.bailReason, 'flip');
});

// ------------------------------------------------------------ holds and grinds

// Like playInputs(), plus ['hold', dir] / ['release'] to hold the finger down.
function playHold(level, inputs, maxTime = 8) {
  const game = new Game(level);
  game.tap();
  const queue = [...inputs].sort((a, b) => a[0] - b[0]);
  const names = [];
  let t = 0;
  while (t < maxTime && game.phase === 'playing') {
    while (queue.length && queue[0][0] <= t + 1e-9) {
      const [, input, dir] = queue.shift();
      if (input === 'tap') game.tap();
      else if (input === 'hold') game.setHold(true, dir || null);
      else if (input === 'release') game.setHold(false);
      else game.swipe(input);
    }
    game.update(STEP);
    t += STEP;
    for (const e of game.drainEvents()) if (e.type === 'trick') names.push(e.name);
  }
  return { game, names };
}

test('holding the finger down from the ollie locks a 50-50 on the rail', () => {
  const { game, names } = playHold(level1, [[0.75, 'tap'], [0.75, 'hold'], [2.2, 'release']]);
  assert.equal(game.phase, 'complete', `bailed: ${game.bailReason}`);
  assert.deepEqual(names, ['50-50 GRIND']);
});

test('a held drag picks the grind: forward is a nose grind, back is a 5-0', () => {
  for (const [dir, name] of [['right', 'NOSE GRIND'], ['left', '5-0 GRIND']]) {
    const { game, names } = playHold(level1, [[0.75, 'tap'], [0.75, 'hold'], [0.9, 'hold', dir]]);
    assert.equal(game.phase, 'complete', `${dir}: bailed ${game.bailReason}`);
    assert.deepEqual(names, [name]);
  }
});

test('the harder grinds score more', () => {
  const score = (dir) => playHold(level1, [[0.75, 'tap'], [0.75, 'hold'], [0.9, 'hold', dir]]).game.score;
  assert.ok(score('right') > score('left') && score('left') > score(null));
});

test('letting go before the rail is a normal air tap, so the rail is clipped', () => {
  const { game } = playHold(level1, [[0.75, 'tap'], [0.75, 'hold'], [0.8, 'release']]);
  assert.equal(game.bailReason, 'clipped');
});

// ------------------------------------------------------------ level 1: gap

const gapLevel = LEVELS[0];

test('gap: ollie just before the edge clears it', () => {
  const { game } = play(gapLevel, [1.0]);
  assert.equal(game.phase, 'complete', `bailed: ${game.bailReason}`);
});

test('gap: no ollie rolls in, too early comes up short', () => {
  assert.equal(play(gapLevel, []).game.bailReason, 'rolled');
  assert.equal(play(gapLevel, [0.6]).game.bailReason, 'gap');
});

test('gap: a kickflip over it is two stars, a 360 flip three', () => {
  assert.equal(play(gapLevel, [0.9, 0.92]).game.stars, 2);
  assert.equal(playInputs(gapLevel, [[0.9, 'tap'], [0.92, 'down-right']]).game.stars, 3);
});

// ------------------------------------------------------------ level 3: stairs

const stairsLevel = LEVELS[2];

test('stairs: the skater starts up on the platform', () => {
  const game = new Game(stairsLevel);
  assert.ok(game.sk.y < 450);
});

test('stairs: ollie the whole set, or bail on the steps', () => {
  assert.equal(play(stairsLevel, [0.95]).game.phase, 'complete');
  assert.equal(play(stairsLevel, [0.7]).game.bailReason, 'stairs');
  assert.equal(play(stairsLevel, []).game.bailReason, 'rolled');
});

test('stairs: without a grind tap the handrail is passed, not clipped', () => {
  const { game, names } = playInputs(stairsLevel, [[0.95, 'tap'], [0.97, 'tap']]);
  assert.equal(game.phase, 'complete');
  assert.deepEqual(names, ['KICKFLIP']);
});

test('stairs: a timed tap grinds the handrail down', () => {
  const { game, names } = playInputs(stairsLevel, [[0.6, 'tap'], [1.2, 'tap']]);
  assert.equal(game.phase, 'complete', `bailed: ${game.bailReason}`);
  assert.deepEqual(names, ['50-50 GRIND']);
});

test('stairs: kickflip in, grind, pop and kickflip out gets three stars', () => {
  const { game } = playInputs(stairsLevel, [[0.6, 'tap'], [0.62, 'tap'], [1.14, 'tap'], [1.4, 'tap'], [1.42, 'tap']]);
  assert.equal(game.phase, 'complete', `bailed: ${game.bailReason}`);
  assert.equal(game.stars, 3, `score ${game.score}`);
});
