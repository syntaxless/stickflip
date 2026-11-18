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
