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

// Points around a circle on screen (y down). ccw = counter-clockwise as seen.
const loop = (ccw, turns = 1, r = 50) => {
  const pts = [];
  for (let i = 0; i <= 40 * turns; i++) {
    const a = (i / 40) * Math.PI * 2 * (ccw ? -1 : 1);
    pts.push({ x: 100 + r * Math.cos(a), y: 100 + r * Math.sin(a) });
  }
  return pts;
};

test('a counter-clockwise circle is a backflip circle, clockwise is not', () => {
  assert.equal(classifyStroke(loop(true)), 'circle');
  assert.equal(classifyStroke(loop(true, 0.8)), 'circle', 'most of the way round is enough');
  assert.notEqual(classifyStroke(loop(false)), 'circle');
});

test('a curved down-left swipe is still a hardflip, not a circle', () => {
  assert.notEqual(classifyStroke(loop(true, 0.25)), 'circle');
  assert.notEqual(classifyStroke(loop(true, 0.5)), 'circle');
  assert.equal(classifyStroke(stroke([0, 60], [-60, 0])), 'down-left');
  assert.equal(classifyStroke(stroke([0, 60], [-60, 0], [0, -40])), 'down-left', 'a hook back up is not a circle');
});
