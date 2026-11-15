import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyStroke } from '../src/gesture.js';

const stroke = (...moves) => {
  const pts = [{ x: 100, y: 100 }];
  for (const [dx, dy] of moves) {
    const last = pts[pts.length - 1];
    for (let i = 1; i <= 5; i++) pts.push({ x: last.x + (dx * i) / 5, y: last.y + (dy * i) / 5 });
  }
  return pts;
};

test('small wobble is a tap', () => {
  assert.equal(classifyStroke(stroke([5, 4], [-3, 2])), 'tap');
  assert.equal(classifyStroke([]), 'tap');
});

test('straight swipes give their direction', () => {
  assert.equal(classifyStroke(stroke([0, 80])), 'down');
  assert.equal(classifyStroke(stroke([0, -80])), 'up');
  assert.equal(classifyStroke(stroke([80, 10])), 'right');
  assert.equal(classifyStroke(stroke([-80, -10])), 'left');
});

test('two-direction strokes give a pattern', () => {
  assert.equal(classifyStroke(stroke([0, 60], [60, 0])), 'down-right');
  assert.equal(classifyStroke(stroke([0, 60], [-60, 0])), 'down-left');
});

test('a short swipe just past the tap radius still has a direction', () => {
  assert.equal(classifyStroke(stroke([0, 20])), 'down');
});
