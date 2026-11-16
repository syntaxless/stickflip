import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyStroke, SHAPES } from '../src/gesture.js';

// A finger stroke through the given corner points (screen px, y down),
// sampled like pointer events, with a little seeded wobble.
function draw(corners, { scale = 60, at = [200, 300], wobble = 3, seed = 1 } = {}) {
  let r = seed;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
  const pts = [];
  for (let i = 1; i < corners.length; i++) {
    const [ax, ay] = corners[i - 1];
    const [bx, by] = corners[i];
    const n = Math.max(3, Math.round((Math.hypot(bx - ax, by - ay) * scale) / 8));
    for (let j = i === 1 ? 0 : 1; j <= n; j++) {
      const t = j / n;
      pts.push({ x: at[0] + (ax + (bx - ax) * t) * scale + rand() * wobble, y: at[1] + (ay + (by - ay) * t) * scale + rand() * wobble });
    }
  }
  return pts;
}

// Points around a circle on screen. ccw = counter-clockwise as seen.
const loop = (ccw, turns = 1, r = 50, from = 0) => {
  const pts = [];
  for (let i = 0; i <= 40 * turns; i++) {
    const a = from + (i / 40) * Math.PI * 2 * (ccw ? -1 : 1);
    pts.push({ x: 100 + r * Math.cos(a), y: 100 + r * Math.sin(a) });
  }
  return pts;
};

test('small wobble is a tap', () => {
  assert.equal(classifyStroke([{ x: 0, y: 0 }, { x: 5, y: 4 }, { x: 2, y: 6 }]), 'tap');
  assert.equal(classifyStroke([]), 'tap');
});

test('every trick shape reads as itself, small or big, wobbly or not', () => {
  for (const [key, shape] of Object.entries(SHAPES)) {
    const want = { ollie: 'kickflip', down: 'heelflip', up: 'shove' }[key] || key;
    for (const scale of [45, 70, 120]) {
      for (const seed of [1, 7, 42]) {
        assert.equal(classifyStroke(draw(shape, { scale, seed, wobble: 3 })), want, `${key} at ${scale}px, seed ${seed}`);
      }
    }
  }
});

test('sloppy versions still read', () => {
  // kickflip with a curved bottom and a shallower finish
  assert.equal(classifyStroke(draw([[0, 0], [0.05, 0.8], [0.15, 0.95], [0.8, -0.6]])), 'kickflip');
  // heelflip that leans a bit
  assert.equal(classifyStroke(draw([[0, 0], [0.15, 1], [-0.4, -0.8]])), 'heelflip');
  // shove-it hook that is more of a V
  assert.equal(classifyStroke(draw([[0, 0], [0.1, 0.8], [0.7, -0.5]])), 'kickflip', 'a V with no hook is a kickflip');
  assert.equal(classifyStroke(draw([[0, 0], [0, 0.7], [0.5, 0.6], [0.7, -0.5]])), 'shove');
  // a straight-ish swipe forward spins, backward spins the other way
  assert.equal(classifyStroke(draw([[0, 0], [1, 0.25]])), 'fs360');
  assert.equal(classifyStroke(draw([[0, 0], [-1, -0.2]])), 'bs360');
});

test('a counter-clockwise circle is the backflip, from any starting point', () => {
  for (const from of [0, 1, 2.5, 4]) assert.equal(classifyStroke(loop(true, 1, 50, from)), 'circle');
  assert.equal(classifyStroke(loop(true, 0.85)), 'circle', 'most of the way round is enough');
  assert.notEqual(classifyStroke(loop(false)), 'circle', 'clockwise is not');
  assert.notEqual(classifyStroke(loop(true, 0.5)), 'circle', 'half a circle is not');
});

test('the loop-shaped flips are not mistaken for the backflip', () => {
  for (const key of ['treflip', 'laser', 'hardflip360', 'inward360', 'shove360', 'fsShove360']) {
    assert.equal(classifyStroke(draw(SHAPES[key], { scale: 70, wobble: 5 })), key);
  }
});
