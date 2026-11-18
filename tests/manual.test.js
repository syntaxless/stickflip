import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { PHYS, MANUALS } from '../src/config.js';

const STEP = 1 / 120;
const level = { id: 'flat-test', name: 'Flat', obstacles: [], width: 6000 }; // nothing but street

// inputs: [time, 'tap' | 'hold' | 'release', dir]
function run(inputs, maxTime = 1.6) {
  const game = new Game(level);
  game.tap();
  const q = [...inputs].sort((a, b) => a[0] - b[0]);
  const log = [];
  let t = 0;
  const mode = [];
  while (t < maxTime && game.phase === 'playing') {
    while (q.length && q[0][0] <= t + 1e-9) {
      const [, k, dir] = q.shift();
      if (k === 'tap') game.tap();
      else if (k === 'hold') game.setHold(true, dir || null);
      else game.setHold(false);
    }
    game.update(STEP);
    t += STEP;
    mode.push(game.sk.mode);
    for (const e of game.drainEvents()) log.push(e.type === 'trick' ? `trick:${e.name}` : e.type);
  }
  return { game, log, mode };
}

// Ollie at 0.1, still in the air for ~0.75 s.
const AIR = [[0.1, 'tap'], [0.2, 'hold']];

test('landing from an ollie while holding a drag back rolls into a manual', () => {
  const { game, log } = run([...AIR, [0.3, 'hold', 'left']]);
  assert.equal(game.sk.mode, 'roll');
  assert.equal(game.sk.manual?.key, 'manual');
  assert.ok(log.includes('manual'));
  assert.equal(game.score, 0, 'the combo is still running, not banked');
});

test('dragging forward is a nose manual', () => {
  const { game } = run([...AIR, [0.3, 'hold', 'right']]);
  assert.equal(game.sk.manual?.key, 'nose');
});

test('no drag at landing, no manual (plain landing banks)', () => {
  const { game } = run([...AIR]);
  assert.equal(game.sk.manual, null);
});

test('a drag that only started at the last moment (a quick flick) is not a manual', () => {
  const { game } = run([...AIR, [0.84, 'hold', 'left']], 0.9);
  assert.equal(game.sk.mode, 'roll');
  assert.equal(game.sk.manual, null);
});

test('a manual cannot start from a plain ride: hold and drag back on the ground does nothing', () => {
  const { game } = run([[0.05, 'hold'], [0.1, 'hold', 'left']], 0.6);
  assert.equal(game.sk.manual, null);
  assert.equal(game.sk.mode, 'roll');
});

test('lifting pops an ollie out of the manual and the combo keeps building', () => {
  const { game, log } = run([...AIR, [0.3, 'hold', 'left'], [1.2, 'release']], 1.3);
  assert.equal(game.sk.manual, null);
  assert.equal(game.sk.mode, 'air');
  assert.ok(log.some((l) => l === 'trick:MANUAL'));
  assert.equal(game.combo.length, 1, 'MANUAL is in the combo, not banked');
  assert.equal(game.score, 0);
});

test('a chain: ollie trick, manual, ollie trick, land: one banked combo with the multiplier', () => {
  const acts = [...AIR, [0.3, 'hold', 'left'], [1.2, 'release']];
  const game = new Game(level);
  game.tap();
  const q = acts.sort((a, b) => a[0] - b[0]);
  let t = 0;
  let banked = null;
  while (t < 3 && game.phase === 'playing') {
    while (q.length && q[0][0] <= t + 1e-9) {
      const [, k, d] = q.shift();
      if (k === 'tap') game.tap();
      else if (k === 'hold') game.setHold(true, d || null);
      else game.setHold(false);
    }
    if (t > 1.25 && game.sk.mode === 'air' && !game.sk.flip && game.combo.length === 1 && !game.chained) {
      game.chained = true;
      game.swipe('kickflip');
    }
    game.update(STEP);
    t += STEP;
    for (const e of game.drainEvents()) if (e.type === 'bank') banked = e;
    if (banked) break;
  }
  assert.ok(banked, 'it banks on the plain landing');
  assert.equal(banked.mult, 2);
  assert.deepEqual(banked.names.map((n) => n.replace(/ .*/, '')).sort(), ['KICKFLIP', 'MANUAL']);
});

test('manuals score by distance; nose manual pays more', () => {
  const pts = (m, dist) => m.base + Math.round(dist * m.perPx);
  assert.ok(pts(MANUALS.nose, 300) > pts(MANUALS.manual, 300));
  const { game } = run([...AIR, [0.3, 'hold', 'left'], [1.3, 'release']], 1.35);
  assert.ok(game.combo[0].points > MANUALS.manual.base);
});

test('the rider drops the board after MANUAL_MAX and the combo banks', () => {
  const { game, log } = run([...AIR, [0.3, 'hold', 'left']], 0.9 + PHYS.MANUAL_MAX + 0.3);
  assert.equal(game.sk.manual, null);
  assert.ok(log.includes('bank'));
  assert.ok(game.score > 0);
});

test('hold and drag down brakes after a short delay; a quick down flick does not', () => {
  const g = new Game(level);
  g.tap();
  g.startCharge();
  g.setHold(true, 'down');
  for (let i = 0; i < 0.1 / STEP; i++) g.update(STEP);
  assert.ok(g.speed >= g.cruise, 'still building the crouched push');
  for (let i = 0; i < 0.5 / STEP; i++) g.update(STEP);
  assert.ok(g.speed < g.cruise, 'braking now');
  g.setHold(true, 'right'); // dragging forward no longer pushes harder
  const v = g.speed;
  g.update(STEP);
  assert.ok(g.speed - v <= PHYS.HOLD_ACCEL * STEP + 1e-9);
});

test('a manual keeps speeding up, and the speed resets when it ends', () => {
  const g = new Game(level);
  g.tap();
  const q = [[0.1, 'tap'], [0.2, 'hold'], [0.3, 'hold', 'left']];
  let t = 0;
  let at2 = 0;
  let started = null;
  while (t < 2.8) {
    while (q.length && q[0][0] <= t + 1e-9) {
      const [, k, d] = q.shift();
      if (k === 'tap') g.tap();
      else g.setHold(true, d || null);
    }
    g.update(STEP);
    t += STEP;
    if (g.sk.manual && started === null) started = g.speed;
    if (started !== null && g.sk.manual && g.sk.manual.t >= 1.5 && !at2) at2 = g.speed;
  }
  assert.ok(started !== null && at2 > started * 1.2, `${started} -> ${at2}`);
  assert.ok(g.speed <= g.cruise * PHYS.MANUAL_SPEED_MAX + 1e-6);
  g.setHold(false); // pop out
  assert.equal(g.speed, g.cruise);
});

import { TRICKS } from '../src/config.js';
import { LEVELS } from '../src/levels/index.js';

// Land into a manual, hold it a moment, lift to pop out, then do the trick.
test('every air trick can be done out of a manual, scoring in the same combo (x2)', () => {
  for (const key of Object.keys(TRICKS)) {
    if (key === 'circle') continue; // the backflip needs big air (not from a flat ollie, manual or not)
    const g = new Game(level);
    g.tap();
    const q = [[0.1, 'tap'], [0.2, 'hold'], [0.3, 'hold', 'left'], [1.1, 'release']];
    let t = 0;
    let bank = null;
    const names = [];
    let swiped = false;
    while (t < 3.5 && g.phase === 'playing') {
      while (q.length && q[0][0] <= t + 1e-9) {
        const [, k, d] = q.shift();
        if (k === 'tap') g.tap();
        else if (k === 'hold') g.setHold(true, d || null);
        else g.setHold(false);
      }
      if (t >= 1.1 && !swiped && g.sk.mode === 'air') {
        g.swipe(key);
        swiped = true;
      }
      g.update(STEP);
      t += STEP;
      for (const e of g.drainEvents()) {
        if (e.type === 'trick') names.push(e.name);
        if (e.type === 'bank') bank = e;
      }
    }
    assert.equal(g.phase, 'playing', `${key}: bailed (${g.bailReason})`);
    assert.ok(bank, `${key}: banks on landing`);
    assert.equal(bank.mult, 2, key);
    assert.ok(names.includes('MANUAL') && names.includes(TRICKS[key].name), `${key}: ${names}`);
  }
});

// ------------------------------------------------ tricks out of grinds

const railLevel = LEVELS[2]; // First Rail
for (const [name, dir, grind] of [['50-50', null, '50-50 GRIND'], ['5-0', 'left', '5-0 GRIND']]) {
  test(`every air trick can be done popping off a ${name}, scoring in the same combo`, () => {
    for (const key of Object.keys(TRICKS)) {
      if (key === 'circle') continue; // needs big air
      const g = new Game(railLevel);
      g.tap();
      let t = 0;
      let grindT = null;
      let swiped = false;
      let bank = null;
      const names = [];
      while (t < 5 && g.phase === 'playing') {
        if (Math.abs(t - 0.45) < STEP / 2) g.tap(); // ollie at the rail
        if (Math.abs(t - 0.45) < STEP / 2) g.setHold(true, dir); // lock the grind by holding (50-50 or 5-0)
        if (g.sk.mode === 'grind' && grindT === null) grindT = t;
        if (grindT !== null && !swiped && t >= grindT + 0.2) {
          g.setHold(false); // (a held grind ignores the lift) then a new touch pops
          g.tap(); // the pop
          g.swipe(key);
          swiped = true;
        }
        g.update(STEP);
        t += STEP;
        for (const e of g.drainEvents()) {
          if (e.type === 'trick') names.push(e.name);
          if (e.type === 'bank') bank = e;
        }
      }
      assert.ok(swiped, `${key}: never grinded`);
      assert.equal(g.phase === 'bailed', false, `${key} out of ${name}: bailed (${g.bailReason})`);
      assert.ok(names.includes(grind) && names.includes(TRICKS[key].name), `${key}: ${names}`);
      assert.ok(bank && bank.mult >= 2, `${key}: banked ${bank?.mult}`);
    }
  });
}

// A slappy (riding into a low curb with the finger held) is a grind too: a new
// touch pops off it and a trick goes straight into the combo.
test('every air trick can be done popping off a slappy', async () => {
  const { STAGES } = await import('../src/stages/index.js');
  for (const key of Object.keys(TRICKS)) {
    if (key === 'circle') continue;
    const g = new Game(STAGES[1], null, { index: 0, score: 0 });
    g.tap();
    g.setHold(true);
    let t = 0;
    let slapT = null;
    let swiped = false;
    const names = [];
    let bank = null;
    while (t < 5 && g.phase === 'playing') {
      if (g.sk.mode === 'grind' && slapT === null) slapT = t;
      if (slapT !== null && !swiped && t >= slapT + 0.2) {
        g.setHold(false);
        g.tap();
        g.swipe(key);
        swiped = true;
      }
      g.update(STEP);
      t += STEP;
      for (const e of g.drainEvents()) {
        if (e.type === 'trick') names.push(e.name);
        if (e.type === 'bank') bank = e;
      }
      if (bank) break; // (the stage rides on into the next obstacle)
    }
    assert.ok(swiped, `${key}: never slappied`);
    assert.notEqual(g.phase, 'bailed', `${key} out of a slappy: bailed (${g.bailReason})`);
    assert.ok(names.includes('SLAPPY 50-50 GRIND') && names.includes(TRICKS[key].name), `${key}: ${names}`);
    assert.ok(bank && bank.mult >= 2, `${key}: banked ${bank?.mult}`);
  }
});

test('the manual speed ramp is steep: about 1.8x after a second, 2.6x after two, capped at 3x', () => {
  const g = new Game(level);
  g.tap();
  const q = [[0.1, 'tap'], [0.2, 'hold'], [0.3, 'hold', 'left']];
  let t = 0;
  let t0 = null;
  const at = {};
  while (t < 3.2 && g.phase === 'playing') {
    while (q.length && q[0][0] <= t + 1e-9) {
      const [, k, d] = q.shift();
      if (k === 'tap') g.tap();
      else g.setHold(true, d || null);
    }
    g.update(STEP);
    t += STEP;
    if (g.sk.manual && t0 === null) t0 = t;
    if (t0 !== null && g.sk.manual) for (const s of [1, 2]) if (!at[s] && t - t0 >= s) at[s] = g.speed / g.cruise;
  }
  assert.ok(at[1] > 1.75 && at[1] < 1.85, `1 s: ${at[1]}`);
  assert.ok(at[2] > 2.55 && at[2] < 2.65, `2 s: ${at[2]}`);
  assert.ok(g.speed / g.cruise <= PHYS.MANUAL_SPEED_MAX + 1e-6);
});

test('a faster manual pays more per pixel than the same distance at cruising speed', () => {
  const g = new Game(level);
  g.tap();
  const q = [[0.1, 'tap'], [0.2, 'hold'], [0.3, 'hold', 'left']];
  let t = 0;
  while (t < 2.5 && g.phase === 'playing') {
    while (q.length && q[0][0] <= t + 1e-9) {
      const [, k, d] = q.shift();
      if (k === 'tap') g.tap();
      else g.setHold(true, d || null);
    }
    g.update(STEP);
    t += STEP;
  }
  const m = g.sk.manual;
  assert.ok(m, 'in a manual');
  assert.ok(m.pts > m.dist * m.type.perPx * 1.3, `${m.pts} vs flat ${m.dist * m.type.perPx}`);
});
