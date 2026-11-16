import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { WORLD, PHYS } from '../src/config.js';
import { LEVELS, SECRET } from '../src/levels/index.js';
import { quarterPipe } from '../src/obstacles/index.js';

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
  for (const lvl of [...LEVELS, SECRET]) {
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

// Like play(), but each input is [time, 'tap' | a TRICKS key from a swipe].
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
  for (const [key, name] of [
    ['heelflip', 'HEELFLIP'],
    ['kickflip', 'KICKFLIP'],
    ['shove', 'POP SHOVE-IT'],
    ['fsShove', 'FS POP SHOVE-IT'],
    ['shove360', '360 SHOVE-IT'],
    ['varialKick', 'VARIAL KICKFLIP'],
    ['varialHeel', 'VARIAL HEELFLIP'],
    ['hardflip', 'HARDFLIP'],
    ['inwardHeel', 'INWARD HEELFLIP'],
    ['fs360', 'FS 360'],
    ['bs360', 'BS 360'],
    ['treflip', '360 FLIP'],
  ]) {
    const { game, names } = playInputs(level1, [[0.75, 'tap'], [0.77, key], [1.36, 'tap']]);
    assert.ok(names.includes(name), `${key} -> ${names}`);
    assert.equal(game.phase, 'complete', `${key}: bailed ${game.bailReason}`);
  }
});

test('a swipe on the ground ollies, and a stroke that is no trick does nothing in the air', () => {
  const { game, names } = playInputs(level1, [[0.75, 'fs360'], [0.77, null], [1.32, 'tap']]);
  assert.deepEqual(names, ['50-50 GRIND'], String(names));
  assert.equal(game.phase, 'complete');
});

test('a long trick started too late is a bail', () => {
  const { game } = playInputs(level1, [[0.2, 'tap'], [0.75, 'treflip']]);
  assert.equal(game.phase, 'bailed');
  assert.equal(game.bailReason, 'flip');
});

test('the biggest flips fit in quarter pipe air', () => {
  for (const [key, name] of [['laser', 'LASER FLIP'], ['hardflip360', '360 HARDFLIP'], ['inward360', '360 INWARD HEEL'], ['fsShove360', 'FS 360 SHOVE-IT']]) {
    const { seen, game } = playActs(LEVELS[5], [[0.4, 'tap'], [0.4, 'hold'], [1.5, 'up'], [2.72, 'swipe', key]], 4.6);
    assert.ok(seen.has(name), `${key}: ${[...seen]}`);
    assert.equal(game.phase, 'playing', `${key}: ${game.bailReason}`);
  }
});

test('charged ollie straight into a trick: hold, drag the shape, lift', () => {
  const flat = { id: 'flat', obstacles: [], width: 4000 };
  const g = new Game(flat);
  g.tap();
  for (let t = 0; t < 0.3; t += STEP) g.update(STEP);
  assert.ok(g.startCharge());
  for (let t = 0; t < 0.5; t += STEP) g.update(STEP);
  assert.ok(g.releaseCharge());
  g.swipe('kickflip'); // what main.js does when the held finger drew a shape
  assert.equal(g.sk.flip?.trick.name, 'KICKFLIP', 'the trick starts on the pop');
  const names = [];
  for (let t = 0; t < 2 && g.sk.mode === 'air'; t += STEP) {
    g.update(STEP);
    for (const e of g.drainEvents()) if (e.type === 'trick') names.push(e.name);
  }
  assert.equal(g.phase, 'playing', g.bailReason);
  assert.ok(names.includes('KICKFLIP'), String(names));
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
  assert.equal(playInputs(gapLevel, [[0.9, 'tap'], [0.92, 'treflip']]).game.stars, 3);
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

// ---------------------------------------------------------------- levels 4-6 + secret

function playActs(level, acts, maxTime = 10) {
  const game = new Game(level);
  game.tap();
  const queue = [...acts].sort((a, b) => a[0] - b[0]);
  const seen = new Set();
  let t = 0;
  while (t < maxTime && game.phase === 'playing') {
    while (queue.length && queue[0][0] <= t + 1e-9) {
      const [, act, arg] = queue.shift();
      if (act === 'tap') game.tap();
      else if (act === 'swipe') game.swipe(arg);
      else if (act === 'hold') game.setHold(true, arg || null);
      else if (act === 'up') game.setHold(false);
    }
    game.update(STEP);
    t += STEP;
    for (const e of game.drainEvents()) seen.add(e.type === 'trick' ? e.name : e.type);
  }
  return { game, seen };
}

const [bankToBank, euroGap, quarter] = [LEVELS[3], LEVELS[4], LEVELS[5]];

test('bank to bank: ollie off the lip clears the gap, rolling off drops in', () => {
  assert.equal(play(bankToBank, [0.9]).game.phase, 'complete');
  assert.equal(play(bankToBank, []).game.bailReason, 'rolled');
  assert.equal(play(bankToBank, [0.4]).game.bailReason, 'gap');
});

test('bank to bank: the skater follows the bank up and is thrown off its lip', () => {
  const game = new Game(bankToBank);
  game.tap();
  let top = Infinity;
  for (let i = 0; i < 150; i++) {
    game.update(STEP);
    top = Math.min(top, game.sk.y);
  }
  assert.ok(top < bankToBank.obstacles[0].ground[0].y2 - 1, 'a little air off the lip');
});

test('euro gap: ollie off the bank up onto the top; early lands on the step, none hits the stairs', () => {
  assert.equal(play(euroGap, [1.1]).game.phase, 'complete');
  assert.equal(play(euroGap, [0.7]).game.bailReason, 'step');
  assert.equal(play(euroGap, []).game.bailReason, 'stairsUp');
  assert.equal(play(euroGap, [1.3]).game.bailReason, 'stairsUp');
});

test('quarter pipe: grind in, air out of the quarter, grind back and exit left', () => {
  const { game, seen } = playActs(quarter, [
    [0.4, 'tap'], [0.4, 'hold'], [1.5, 'up'],
    [2.77, 'tap'], // kickflip in the air
    [4.5, 'tap'], [4.5, 'hold', 'left'], [7, 'up'],
  ]);
  assert.equal(game.phase, 'complete', `bailed: ${game.bailReason}`);
  assert.ok(seen.has('50-50 GRIND') && seen.has('KICKFLIP') && seen.has('FS AIR'));
  assert.ok(seen.has('NOSE GRIND'), 'dragging forward (left) on the way back is a nose grind');
  assert.ok(game.sk.x < 0 && game.sk.dir === -1);
  assert.equal(game.speed, game.baseSpeed * PHYS.QP_SPEED, 'rides out faster than it came in');
});

test('quarter pipe: doing nothing slams the rail, a late flip in the air is a bail', () => {
  assert.equal(play(quarter, []).game.bailReason, 'slam');
  const { game } = playActs(quarter, [[0.4, 'tap'], [0.4, 'hold'], [1.5, 'up'], [3.52, 'tap']]);
  assert.equal(game.bailReason, 'flip');
});

test('quarter pipe: straight up and down at riding speed, over a second of hang time for two tricks', () => {
  const { game, seen } = playActs(quarter, [
    [0.4, 'tap'], [0.4, 'hold'], [1.5, 'up'],
    [2.72, 'swipe', 'treflip'], // 360 flip
    [3.32, 'tap'], // then a kickflip
  ], 4.6);
  assert.ok(seen.has('360 FLIP') && seen.has('KICKFLIP') && seen.has('FS AIR'), [...seen].join());
  assert.equal(game.phase, 'playing');
  assert.equal(game.sk.dir, -1);
  assert.equal(game.sk.face, 1, 'no turning around: back out fakie');
});

test('quarter pipe: the air goes up and comes down at a steady riding speed', () => {
  const { game } = playActs(quarter, [[0.4, 'tap'], [0.4, 'hold'], [1.5, 'up']], 3.2);
  assert.ok(game.sk.qpAir, 'in the air off the quarter');
  assert.equal(Math.abs(game.sk.vy), game.speed);
  assert.equal(game.sk.vx, 0);
});
test('quarter pipe: riding up the curve keeps the riding pace across the screen', () => {
  const game = new Game({ id: 'qp', obstacles: [quarterPipe({ x: 760, radius: 120 })] });
  game.tap();
  let px = game.sk.x;
  let frames = 0;
  for (let i = 0; i < 120 * 4 && !game.sk.qpAir; i++) {
    game.update(STEP);
    const s = game.sk;
    if (s.mode === 'ramp' && s.ramp.th < 0.8) {
      frames++;
      assert.ok((s.x - px) / STEP > game.baseSpeed * 0.97, `slowed to ${((s.x - px) / STEP).toFixed(0)} across`);
    }
    px = game.sk.x;
  }
  assert.ok(frames > 10);
});

test('secret mega ramp: ollie the kicker over the rail, or grind it, then air the quarter', () => {
  const clear = playActs(SECRET, [[1.1, 'tap']]);
  assert.equal(clear.game.phase, 'complete', `bailed: ${clear.game.bailReason}`);
  assert.ok(clear.seen.has('FS AIR'));
  const grind = playActs(SECRET, [[1.35, 'tap']]);
  assert.equal(grind.game.phase, 'complete', `bailed: ${grind.game.bailReason}`);
  assert.ok(grind.seen.has('50-50 GRIND'));
  assert.equal(play(SECRET, []).game.bailReason, 'clipped', 'no input lands on the rail');
});

test('secret mega ramp: the ollie clears the whole rainbow rail into the bank, the grind follows the curve', () => {
  const rail = SECRET.obstacles.find((o) => o.type === 'rail').surfaces[0];
  const bank = SECRET.obstacles.flatMap((o) => o.ground || []).find((g) => g.x1 === rail.x2 && g.y2 > g.y1);
  assert.ok(bank, 'the landing bank starts at the end of the rail');
  for (const t of [1.05, 1.1, 1.15]) {
    const g = new Game(SECRET);
    g.tap();
    let landX = null;
    for (let s = 0; s < 3 && landX === null; s += STEP) {
      if (Math.abs(s - t) < STEP / 2) g.tap();
      g.update(STEP);
      for (const e of g.drainEvents()) if (e.type === 'land' && e.x > 600) landX = e.x;
    }
    assert.ok(landX > rail.x2 && landX < bank.x2, `ollie at ${t} lands at ${landX}`);
  }
  const g = new Game(SECRET);
  g.tap();
  const ys = [];
  for (let s = 0; s < 3; s += STEP) {
    if (Math.abs(s - 1.35) < STEP / 2) g.tap();
    g.update(STEP);
    if (g.sk.mode === 'grind') ys.push([g.sk.x, g.sk.y]);
  }
  assert.ok(ys.length > 10, 'grinded');
  const mid = (rail.x1 + rail.x2) / 2;
  const top = Math.min(...ys.map(([, y]) => y));
  assert.ok(top < rail.y - rail.arc * 0.9, 'rides up over the hump');
  const [peakX] = ys.find(([, y]) => y === top);
  assert.ok(Math.abs(peakX - mid) < 40 || ys[0][0] > mid, 'highest in the middle');
});

test('charged ollie: a quick hold is a normal ollie, a long hold pops higher (capped)', () => {
  const flat = { id: 'flat', obstacles: [], width: 4000 };
  const peak = (holdTime) => {
    const game = new Game(flat);
    game.tap();
    game.startCharge();
    for (let t = 0; t < holdTime; t += STEP) game.update(STEP);
    assert.ok(game.releaseCharge());
    let top = Infinity;
    while (game.sk.mode === 'air') {
      game.update(STEP);
      top = Math.min(top, game.sk.y);
    }
    return WORLD.GROUND - top;
  };
  const tap = peak(0.05);
  const normal = new Game(LEVELS[0]);
  assert.ok(Math.abs(tap - 169) < 6, `tap height ${tap}`);
  assert.ok(peak(0.4) > tap * 1.05);
  assert.ok(peak(0.8) > tap * 1.2, 'a full charge is about 1.25x as high');
  assert.ok(Math.abs(peak(2) - peak(0.8)) < 2, 'capped');
  assert.ok(peak(2) < tap * 1.3, 'only a little higher');
  assert.equal(normal.chargeLevel(), 0);
});

test('charged ollie: only from the ground, and the crouch level grows with the hold', () => {
  const game = new Game(LEVELS[0]);
  assert.equal(game.startCharge(), false, 'not before the run starts');
  game.tap();
  assert.equal(game.startCharge(), true);
  game.update(0.1);
  assert.equal(game.chargeLevel(), 0);
  for (let i = 0; i < 40; i++) game.update(STEP);
  assert.ok(game.chargeLevel() > 0.3);
});
test('backflip: a circle in the quarter pipe air lands, too late is a bail, a normal ollie is too short', () => {
  const qpActs = [[0.4, 'tap'], [0.4, 'hold'], [1.5, 'up']];
  const ok = playActs(quarter, [...qpActs, [2.72, 'swipe', 'circle']], 4.6);
  assert.ok(ok.seen.has('BACKFLIP') && ok.seen.has('FS AIR'), [...ok.seen].join());
  assert.equal(ok.game.phase, 'playing');
  const late = playActs(quarter, [...qpActs, [3.27, 'swipe', 'circle']], 4.6);
  assert.equal(late.game.bailReason, 'flip');
  const flat = playActs({ id: 'flat', obstacles: [], width: 4000 }, [[0.3, 'tap'], [0.32, 'swipe', 'circle']], 2);
  assert.equal(flat.game.bailReason, 'flip', 'an ollie is not enough air for a backflip');
  // nor is a fully charged one, even with the circle drawn while charging
  const g = new Game({ id: 'flat', obstacles: [], width: 4000 });
  g.tap();
  for (let t = 0; t < 0.3; t += STEP) g.update(STEP);
  g.startCharge();
  for (let t = 0; t < 1; t += STEP) g.update(STEP);
  assert.ok(g.releaseCharge());
  g.swipe('circle');
  for (let t = 0; t < 2 && g.phase === 'playing'; t += STEP) g.update(STEP);
  assert.equal(g.bailReason, 'flip', 'a charged ollie on flat ground is not enough air for a backflip');
});

test('time spent drawing a shape counts toward the trick, so a drawn kickflip still lands', () => {
  const flat = { id: 'flat', obstacles: [], width: 4000 };
  const run = (drawn) => {
    const g = new Game(flat);
    g.tap();
    for (let t = 0; t < 0.3; t += STEP) g.update(STEP);
    g.tap(); // ollie
    for (let t = 0; t < 0.4; t += STEP) g.update(STEP); // the finger draws for 0.4 s
    g.swipe('kickflip', drawn);
    for (let t = 0; t < 1 && g.phase === 'playing' && g.sk.mode === 'air'; t += STEP) g.update(STEP);
    return g;
  };
  assert.equal(run(0).bailReason, 'flip', 'without the credit the flip comes too late');
  assert.equal(run(0.4).phase, 'playing', 'with it, it lands');
});
