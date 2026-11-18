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

test('charging: only the shape drawn after the finger rests counts, and a long speed drag is a plain ollie', async () => {
  const { readChargeStroke } = await import('../src/gesture.js');
  const at = (pts, t0, dt) => pts.map(([x, y], i) => ({ x, y, t: t0 + i * dt }));
  // A kickflip drawn quickly straight away
  const kick = [[100, 100], [100, 130], [100, 160], [110, 130], [120, 100], [130, 70], [136, 40]];
  assert.equal(readChargeStroke(at(kick, 0, 0.03)).key, 'kickflip');
  // Drag forward to push, rest, then the kickflip
  const drag = at([[0, 100], [40, 100], [80, 100], [100, 100]], 0, 0.05);
  const rest = [{ x: 100, y: 100, t: 0.6 }];
  assert.equal(readChargeStroke([...drag, ...rest, ...at(kick, 0.62, 0.03)]).key, 'kickflip');
  // Drag forward, rest, let go: a plain ollie
  assert.equal(readChargeStroke([...drag, ...rest, { x: 101, y: 100, t: 0.9 }]).key, 'tap');
  // A slow drag back all the way to the lift: still a plain ollie, not a BS 360
  const slow = at(Array.from({ length: 20 }, (_, i) => [200 - i * 6, 100]), 0, 0.06);
  assert.equal(readChargeStroke(slow).key, 'tap');
  // A quick flick forward is still an FS 360
  assert.equal(readChargeStroke(at([[0, 100], [40, 100], [80, 100], [120, 100]], 0, 0.03)).key, 'fs360');
});

test('manual: drag back, rest, then draw any flip shape: it reads as that trick', async () => {
  const { readChargeStroke, SHAPES: S } = await import('../src/gesture.js');
  const SIMPLE = { ollie: 'kickflip', down: 'heelflip', up: 'shove' };
  for (const key of Object.keys(S)) {
    // the drag back that held the manual (0.5 s), a rest, then the shape drawn quickly
    const drag = Array.from({ length: 10 }, (_, i) => ({ x: 300 - i * 6, y: 300, t: i * 0.05 }));
    const rest = [{ x: 246, y: 300, t: 0.75 }];
    const shape = draw(S[key], { scale: 70, at: [246, 300], wobble: 2 }).map((p, i) => ({ ...p, t: 0.8 + i * 0.015 }));
    const r = readChargeStroke([...drag, ...rest, ...shape]);
    assert.equal(r.key, SIMPLE[key] || key, key);
  }
});
