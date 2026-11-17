import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';
import { box } from './box.js';

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
