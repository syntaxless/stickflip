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

// "OSLO CITY LIMITS": a green and white highway sign on two posts, standing behind the
// action (pure decor), with a graffiti tag, Rune, sprayed on its bottom corner.
const TAG_GLYPHS = {
  R: ['####.', '#...#', '####.', '#..#.', '#...#'],
  u: ['#...#', '#...#', '#...#', '#..##', '.##.#'],
  n: ['.###.', '#...#', '#...#', '#...#', '#...#'],
  e: ['.###.', '#...#', '#####', '#....', '.###.'],
};
function sprayTag(g, word, x, y, fill, outline) {
  // slanted handwriting: every row leans right, with an outline round each stroke
  const cells = [];
  let cx = x;
  for (const ch of word) {
    TAG_GLYPHS[ch].forEach((row, ry) => {
      for (let rx = 0; rx < 5; rx++) if (row[rx] === '#') cells.push([cx + rx + ((4 - ry) >> 1), y + ry]);
    });
    cx += 6;
  }
  for (const [px, py] of cells) for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]]) g.pset(px + dx, py + dy, outline); // a dark edge down and to the right
  for (const [px, py] of cells) g.pset(px, py, fill);
  // a couple of drips off the bottom of the letters
  const [dx1, dx2] = [x + 9, x + 20];
  g.line(dx1, y + 6, dx1, y + 8, fill);
  g.pset(dx2, y + 6, fill);
  g.pset(dx2, y + 7, fill);
  g.pset(dx1, y + 9, outline);
}

export function citySign({ x, base = WORLD.GROUND, height = 240, w = 84 }) {
  return {
    type: 'city-sign',
    surfaces: [],
    solids: [],
    draw(g) {
      const b = P(base) - 1;
      const l = P(x);
      const top = P(base - height);
      const h = 48;
      const r = l + w - 1;
      // two steel posts down to the street
      for (const px of [l + 14, r - 14]) {
        g.fill(px - 1, top + h, 3, b - top - h + 1, steel);
        g.line(px - 1, top + h, px - 1, b, ink);
        g.line(px + 1, top + h, px + 1, b, ink);
        g.line(px, top + h, px, b, shine);
      }
      // the panel: highway green with a black outer edge, a white border and white lettering
      const GREEN = [0, 112, 64];
      g.fill(l, top, w, h, GREEN);
      g.rect(l, top, w, h, ink);
      g.rect(l + 2, top + 2, w - 4, h - 4, white);
      g.line(l + 3, top + 3, r - 3, top + 3, [210, 240, 220]);
      for (const [cx, cy] of [[l, top], [r, top], [l, top + h - 1], [r, top + h - 1]]) g.pset(cx, cy, [130, 160, 190]);
      g.text('OSLO', l + (w >> 1), top + 7, white, 2, 'center');
      g.line(l + 9, top + 23, r - 9, top + 23, white);
      g.text('CITY LIMITS', l + (w >> 1), top + 27, white, 1, 'center');
      sprayTag(g, 'Rune', r - 31, top + h - 12, [0, 0, 0], [150, 215, 175]); // black paint, with a pale edge so it reads on the green
    },
  };
}

// A fire hydrant: red body with a silver cap, bonnet, collar and side
// nozzles, about the size of a street trash can. Ollie over it.
export function hydrant({ x, w = 54, h = 90, base = WORLD.GROUND }) {
  return {
    ...box({ x, w, h, base }),
    type: 'hydrant',
    draw(g) {
      const [l, r, b] = [P(x), P(x + w) - 1, P(base) - 1];
      const rows = P(h);
      const t = b - rows + 1;
      const red = PAL.flame;
      const redDark = [150, 25, 30];
      const c = (l + r) >> 1;
      // cap: a silver dome on a short stem
      g.fill(c - 3, t + 2, 7, 3, steel);
      g.rect(c - 3, t + 2, 7, 3, ink);
      g.line(c - 2, t + 3, c, t + 3, shine);
      g.line(c - 1, t, c + 1, t, ink);
      g.pset(c - 2, t + 1, ink);
      g.pset(c + 2, t + 1, ink);
      g.pset(c, t + 1, steel);
      // bonnet (wider than the barrel) and barrel, outlined, lit from the left
      g.fill(c - 5, t + 5, 11, 6, red);
      g.rect(c - 5, t + 5, 11, 6, ink);
      g.line(c - 4, t + 6, c - 4, t + 9, orange);
      g.fill(c - 4, t + 11, 9, b - t - 14, red);
      g.rect(c - 4, t + 11, 9, b - t - 14, ink);
      g.line(c - 3, t + 12, c - 3, b - 5, orange); // lit left edge
      g.line(c + 3, t + 12, c + 3, b - 5, redDark); // shaded right edge
      // collars
      for (const y of [t + 11, b - 7]) {
        g.line(c - 5, y, c + 5, y, ink);
        g.line(c - 4, y, c + 4, y, steel);
      }
      // side nozzles, with caps
      for (const [nx, dir] of [[c - 4, -1], [c + 5, 1]]) {
        g.fill(dir < 0 ? nx - 3 : nx, t + 16, 3, 5, steel);
        g.rect(dir < 0 ? nx - 3 : nx, t + 16, 3, 5, ink);
        g.pset(dir < 0 ? nx - 2 : nx + 1, t + 17, shine);
      }
      g.fill(c - 1, t + 14, 3, 3, steel); // front port
      g.rect(c - 1, t + 14, 3, 3, ink);
      // base plate
      g.fill(c - 6, b - 2, 13, 3, ink);
      g.line(c - 5, b - 2, c + 5, b - 2, steel);
    },
  };
}

// A traffic barrel: an orange drum with white reflective bands, a flat top ring
// and a wider base. Ollie over it (its sides slam you, the top is no place to land).
export function trafficBarrel({ x, w = 60, h = 96, base = WORLD.GROUND }) {
  return {
    ...box({ x, w, h, base }),
    type: 'traffic-barrel',
    draw(g) {
      const [l, r, b] = [P(x), P(x + w) - 1, P(base) - 1];
      const t = b - P(h) + 1;
      const orangeDark = [190, 90, 0];
      const whiteDark = [190, 190, 200];
      // body, a pixel narrower at the top than the base, outlined
      const inset = (y) => (y < t + 4 ? 2 : y > b - 4 ? 0 : 1);
      for (let y = t; y <= b; y++) {
        const i = inset(y);
        const band = Math.floor((y - t - 4) / 5);
        const striped = y > t + 3 && y < b - 3 && band % 2 === 1;
        const [lit, mid, dark] = striped ? [white, white, whiteDark] : [[255, 170, 60], orange, orangeDark];
        g.line(l + i, y, r - i, y, mid);
        g.line(l + i + 1, y, l + i + 3, y, lit); // lit left side
        g.line(r - i - 2, y, r - i, y, dark); // shaded right side
        g.pset(l + i, y, ink);
        g.pset(r - i, y, ink);
      }
      // top ring and a dark hole at the very top, base lip
      g.line(l + 2, t, r - 2, t, ink);
      g.line(l + 3, t + 1, r - 3, t + 1, ink);
      g.line(l + 3, t + 2, l + 6, t + 2, shine);
      g.line(l, b, r, b, ink);
      g.line(l + 1, b - 1, r - 1, b - 1, orangeDark);
      // band outlines
      for (let y = t + 4; y < b - 3; y += 5) {
        g.pset(l + inset(y), y, ink);
        g.pset(r - inset(y), y, ink);
      }
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
