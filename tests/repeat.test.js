import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { SCORE, SPECIAL_POINTS } from '../src/config.js';

const level = { id: 'flat-test', name: 'Flat', obstacles: [], width: 6000 };
const fresh = () => {
  const g = new Game(level);
  g.tap();
  return g;
};
const worth = (g) => g.combo.map((t) => t.points);

test('repeating a trick in one combo: 100%, 50%, 25%, then never under 10%', () => {
  const g = fresh();
  for (let i = 0; i < 6; i++) g.addTrick('KICKFLIP', 150);
  assert.deepEqual(worth(g), [150, 75, 38, 19, 15, 15]); // 150, 75, 37.5, 18.75, then the 10% floor (15)
  assert.equal(SCORE.REPEAT_MIN * 150, 15);
});

test('different tricks do not decay each other', () => {
  const g = fresh();
  g.addTrick('KICKFLIP', 150);
  g.addTrick('HEELFLIP', 150);
  g.addTrick('POP SHOVE-IT', 100);
  assert.deepEqual(worth(g), [150, 150, 100]);
});

test('across the run: banked tricks stay in memory for the window, and the same trick pays less, recovering as others push it out', () => {
  const g = fresh();
  g.addTrick('KICKFLIP', 150);
  g.bankCombo();
  g.addTrick('KICKFLIP', 150);
  assert.equal(worth(g)[0], Math.round(150 * SCORE.REPEAT_RUN)); // 128
  g.bankCombo();
  // a few different tricks push it out of the window
  for (let i = 0; i < SCORE.RUN_WINDOW; i++) {
    g.addTrick(`OTHER ${i}`, 50);
    g.bankCombo();
  }
  g.addTrick('KICKFLIP', 150);
  assert.equal(worth(g)[0], 150, 'back to full value');
});

test('specials (300+) and named gap bonuses are exempt, everywhere', () => {
  const g = fresh();
  assert.ok(SPECIAL_POINTS >= 300);
  g.addTrick('360 FLIP', 300);
  g.addTrick('360 FLIP', 300);
  g.addTrick('SOME GAP', 250, 'gap');
  g.addTrick('SOME GAP', 250, 'gap');
  assert.deepEqual(worth(g), [300, 300, 250, 250]);
  g.bankCombo();
  g.addTrick('360 FLIP', 300);
  assert.deepEqual(worth(g), [300]);
});

test('the trick event and the banked score carry the decayed value', () => {
  const g = fresh();
  g.addTrick('KICKFLIP', 150);
  g.addTrick('KICKFLIP', 150);
  const evs = g.drainEvents().filter((e) => e.type === 'trick');
  assert.deepEqual(evs.map((e) => e.points), [150, 75]);
  assert.equal(evs[1].base, 150);
  const before = g.score;
  g.bankCombo();
  assert.equal(g.score - before, (150 + 75) * 2);
});

test('a bail loses the combo and does not count towards the run memory', () => {
  const g = fresh();
  g.addTrick('KICKFLIP', 150);
  g.bail('slam');
  assert.deepEqual(g.recent, []);
});
