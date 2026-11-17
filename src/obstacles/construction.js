import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';
import { box } from './box.js';
import { rail } from './rail.js';
import { pipe, post } from '../render/shaded.js';

// Stage 3's construction site. Every piece is a plain box underneath (its sides
// slam you, so ollie over it) drawn as chunky shaded pixel art: black outline,
// orange and white paint, grey metal.
const P = (v) => Math.round(v / 3);
const { ink, steel, shine, wheel: white, orange, fire: yellow } = PAL;

// A traffic cone. Ollie over it.
export function cone({ x, w = 30, h = 48, base = WORLD.GROUND }) {
  return {
    ...box({ x, w, h, base }),
    type: 'cone',
    draw(g) {
      const [l, r, b] = [P(x), P(x + w) - 1, P(base) - 1];
      const rows = P(h);
      const c = (l + r) >> 1;
      const half = (r - l) / 2;
      for (let i = 0; i < rows - 2; i++) {
        const y = b - rows + 1 + i;
        const hw = Math.round(1 + (i * (half - 1.5)) / (rows - 3));
        const stripe = i >= 4 && i <= 6;
        g.line(c - hw, y, c + hw, y, stripe ? white : orange);
        g.pset(c - hw, y, ink);
        g.pset(c + hw, y, ink);
        if (i === 0) g.line(c - hw, y, c + hw, y, ink);
        else if (!stripe) g.pset(c - hw + 1, y, yellow); // lit left edge
      }
      g.fill(l, b - 1, r - l + 1, 2, ink); // square base
      g.line(l + 1, b - 1, r - 1, b - 1, steel);
    },
  };
}

// A jersey barrier: a long, low concrete block with an orange band, grindable
// like a curb.
export function barrier({ x, w = 220, h = 36, base = WORLD.GROUND, landable = true, grindable = true }) {
  const solid = box({ x, w, h, landable, grindable, base });
  return {
    ...solid,
    type: 'barrier',
    draw(g, fx) {
      solid.draw(g, fx);
      const [l, t, r, b] = [P(x), P(base - h), P(x + w) - 1, P(base) - 1];
      const y1 = t + 3;
      const y2 = Math.min(b - 2, t + 6);
      for (let px = l + 2; px < r - 3; px += 8) {
        g.fill(px, y1, 4, y2 - y1 + 1, orange);
        g.fill(px + 4, y1, 4, y2 - y1 + 1, white);
      }
      g.line(l + 1, y1 - 1, r - 1, y1 - 1, ink);
      g.line(l + 1, y2 + 1, r - 1, y2 + 1, ink);
    },
  };
}

// A sawhorse barricade: two striped planks on legs. Ollie over it.
export function sawhorse({ x, w = 90, h = 54, base = WORLD.GROUND }) {
  return {
    ...box({ x, w, h, base }),
    type: 'sawhorse',
    draw(g) {
      const [l, t, r, b] = [P(x), P(base - h), P(x + w) - 1, P(base) - 1];
      for (const [y, tall] of [[t, 5], [t + 8, 5]]) {
        g.fill(l, y, r - l + 1, tall, white);
        for (let px = l + 1; px < r; px += 6) g.fill(px, y + 1, 3, tall - 2, orange);
        g.rect(l, y, r - l + 1, tall, ink);
      }
      for (const [a, z] of [[l + 2, l - 0], [r - 2, r + 0]]) {
        g.line(a, t + 13, z, b, ink);
        g.line(a + 1, t + 13, z + 1, b, steel);
      }
      g.line(l, b, l + 3, b, ink);
      g.line(r - 3, b, r, b, ink);
      g.pset(l + 2, t + 1, shine);
    },
  };
}

// A road sign on a post, standing behind the action: pure decor.
export function sign({ x, base = WORLD.GROUND, height = 150 }) {
  return {
    type: 'sign',
    surfaces: [],
    solids: [],
    draw(g) {
      const px = P(x);
      const b = P(base) - 1;
      const top = P(base - height);
      g.line(px, top + 9, px, b, ink);
      g.line(px - 1, top + 9, px - 1, b, steel);
      const r = 8; // a yellow diamond with a black border and an exclamation mark
      for (let i = -r; i <= r; i++) {
        const w = r - Math.abs(i);
        g.line(px - w, top + r + i, px + w, top + r + i, yellow);
        g.pset(px - w, top + r + i, ink);
        g.pset(px + w, top + r + i, ink);
      }
      g.pset(px, top, ink);
      g.pset(px, top + 2 * r, ink);
      g.line(px, top + 5, px, top + 10, ink);
      g.pset(px, top + 12, ink);
    },
  };
}

// A fire hydrant: red body, silver cap and side nozzles. Ollie over it.
export function hydrant({ x, w = 24, h = 39, base = WORLD.GROUND }) {
  return {
    ...box({ x, w, h, base }),
    type: 'hydrant',
    draw(g) {
      const [l, r, b] = [P(x), P(x + w) - 1, P(base) - 1];
      const rows = P(h);
      const t = b - rows + 1;
      const red = PAL.flame;
      const c = (l + r) >> 1;
      // cap: a small dome, silver
      g.fill(c - 2, t + 1, 5, 2, steel);
      g.line(c - 1, t, c + 1, t, ink);
      g.pset(c - 2, t + 1, ink);
      g.pset(c + 2, t + 1, ink);
      g.line(c - 1, t + 1, c, t + 1, shine);
      g.pset(c, t - 1, ink);
      // bonnet and body, outlined, lit from the left
      g.fill(c - 3, t + 3, 7, rows - 5, red);
      g.rect(c - 3, t + 3, 7, rows - 5, ink);
      g.line(c - 2, t + 4, c - 2, b - 3, orange);
      g.line(c - 4, t + 6, c + 4, t + 6, ink); // collar
      g.line(c - 3, t + 6, c + 3, t + 6, steel);
      // side nozzles
      for (const nx of [c - 5, c + 4]) {
        g.fill(nx, t + 8, 2, 3, steel);
        g.rect(nx, t + 8, 2, 3, ink);
      }
      g.pset(c - 4, t + 8, shine);
      // base plate
      g.fill(c - 4, b - 1, 9, 2, ink);
      g.line(c - 3, b - 1, c + 3, b - 1, steel);
    },
  };
}

// Scaffolding: a rail along the top plank (grind it like any rail) on a
// braced pipe frame. Same physics as a rail.
export function scaffold({ x, length, height, base = WORLD.GROUND }) {
  const bar = rail({ x, length, height, base });
  return {
    ...bar,
    type: 'scaffold',
    draw(g, fx) {
      const top = P(base - height);
      const b = P(base) - 1;
      const [l, r] = [P(x), P(x + length)];
      // uprights every ~100 units with a cross brace in each bay
      const n = Math.max(2, Math.round(length / 100));
      const xs = Array.from({ length: n + 1 }, (_, i) => l + Math.round(((r - l) * i) / n));
      for (let i = 0; i < n; i++) {
        pipe(g, xs[i], top + 4, xs[i + 1], b - 3); // brace down
        pipe(g, xs[i], b - 3, xs[i + 1], top + 4); // brace up
        g.line(xs[i], b - Math.round((b - top) / 2), xs[i + 1], b - Math.round((b - top) / 2), ink); // mid tube
      }
      for (const px of xs) post(g, px, top + 3, b);
      bar.draw(g, fx); // the grindable pipe on top, over the frame
    },
  };
}
