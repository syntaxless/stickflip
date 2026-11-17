import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';
import { box } from './box.js';
import { rail } from './rail.js';
import { gap } from './gap.js';
import { stepsUp } from './steps-up.js';
import { pipe, post } from '../render/shaded.js';

// Stage 4's playground. Toy and playground gear built from the same pieces as
// the other stages (boxes, rails, gaps, steps), drawn in bright chunky pixel art.
const P = (v) => Math.round(v / 3);
const { ink, steel, shine, wheel: white } = PAL;
const RED = [255, 85, 85];
const YELLOW = [255, 255, 85];
const BLUE = [85, 85, 255];
const GREEN = [85, 200, 85];
const WOOD = [170, 85, 0];
const SAND = [238, 214, 130];
const COLORS = [RED, YELLOW, BLUE, GREEN];
const ORANGE = [255, 150, 40];
const PURPLE = [190, 90, 230];
const PINK = [255, 140, 200];
const CYAN = [90, 220, 230];
const BALLS = [RED, YELLOW, BLUE, GREEN, ORANGE, PURPLE, PINK, CYAN];

// A toy block: a bright cube with a lit top-left edge and a white dot on its face.
function drawBlock(g, l, t, r, b, c, dot = true) {
  g.fill(l, t, r - l + 1, b - t + 1, c);
  g.rect(l, t, r - l + 1, b - t + 1, ink);
  g.line(l + 1, t + 1, r - 1, t + 1, white);
  g.line(l + 1, t + 1, l + 1, b - 1, white);
  if (dot) g.fill(Math.round((l + r) / 2), Math.round((t + b) / 2), 2, 2, white);
}

// One or more toy blocks side by side: `blocks` is [{ x, w, h }]. Ollie over them.
export function toyBlocks({ blocks, base = WORLD.GROUND }) {
  const parts = blocks.map((b) => box({ x: b.x, w: b.w, h: b.h, base }));
  return {
    type: 'toy-blocks',
    surfaces: parts.flatMap((p) => p.surfaces),
    solids: parts.flatMap((p) => p.solids),
    draw(g) {
      blocks.forEach((b, i) => drawBlock(g, P(b.x), P(base - b.h), P(b.x + b.w) - 1, P(base) - 1, COLORS[i % COLORS.length]));
    },
  };
}

// A slide: a yellow chute standing on legs, raised off the street, sloping
// from (x1, y1) down to (x2, y2). Grind it like a rail: roll off the top of the
// ladder platform with the finger held and you lock onto it. (Let go and you
// clip it.) You ride it down and drop the last bit to the street.
export function slideChute({ x1, y1, x2, y2, base = WORLD.GROUND }) {
  const surface = { x1, x2, y1, y2, grindable: true, landable: false };
  return {
    type: 'slide',
    surfaces: [surface],
    solids: [],
    draw(g) {
      const [a, b, c, d] = [P(x1), P(y1), P(x2), P(y2)];
      const floor = P(base) - 1;
      const yAt = (px) => b + Math.round(((px - a) * (d - b)) / Math.max(1, c - a));
      // legs: a post every ~25 px under the chute
      for (let px = a + 6; px < c; px += 26) {
        g.line(px, yAt(px) + 1, px, floor, ink);
        g.line(px + 1, yAt(px) + 1, px + 1, floor, steel);
        g.line(px + 2, yAt(px) + 1, px + 2, floor, ink);
      }
      // the chute: a thick yellow trough with a dark underside and a white lit edge
      g.line(a, b - 3, c, d - 3, ink);
      g.line(a, b - 2, c, d - 2, white);
      g.line(a, b - 1, c, d - 1, YELLOW);
      g.line(a, b, c, d, YELLOW);
      g.line(a, b + 1, c, d + 1, [210, 170, 40]);
      g.line(a, b + 2, c, d + 2, ink);
      // a red side rail along the top and a post at the lip
      g.line(a, b - 9, a, b, ink);
      g.line(a + 1, b - 9, a + 1, b, RED);
      g.line(a, b - 9, a + 14, b - 7, ink);
      g.line(a, b - 8, a + 14, b - 6, RED);
    },
  };
}

// The slide's ladder and deck: a sloped ladder (side rails and rungs) leading up
// to a small platform on legs, standing on the street. You ride up it like a
// ramp: the ground under it is the street, so it is open underneath.
export function slideLadder({ x, run = 120, rise = 70, deck = 60 }) {
  const G = WORLD.GROUND;
  const ground = [
    { x1: x, x2: x + run, y1: G, y2: G - rise, landable: true, under: true },
    { x1: x + run, x2: x + run + deck, y1: G - rise, y2: G - rise, landable: true, under: true },
  ];
  return {
    type: 'slide-ladder',
    surfaces: [],
    solids: [],
    ground,
    draw(g) {
      const [a, m, e] = [P(x), P(x + run), P(x + run + deck) - 1];
      const [street, top] = [P(G), P(G - rise)];
      const floor = street - 1;
      const slopeY = (px) => street + Math.round(((px - a) * (top - street)) / Math.max(1, m - a));
      // legs under the platform: two posts down to the street
      for (const px of [m + 4, e - 6]) {
        g.line(px, top + 4, px, floor, ink);
        g.line(px + 1, top + 4, px + 1, floor, steel);
        g.line(px + 2, top + 4, px + 2, floor, ink);
      }
      // the ladder: an upper side rail along the riding line, a lower one 8 px below, and rungs between
      for (let px = a; px <= m; px++) {
        const y = slopeY(px);
        g.pset(px, y, YELLOW);
        g.pset(px, y + 1, [210, 170, 40]);
        g.pset(px, y + 2, ink);
        g.pset(px, y - 1, ink);
        g.pset(px, y + 8, ink);
        g.pset(px, y + 9, steel);
        g.pset(px, y + 10, ink);
      }
      for (let px = a + 3; px < m; px += 6) {
        const y = slopeY(px);
        g.line(px, y + 3, px, y + 7, ink);
        g.line(px + 1, y + 3, px + 1, y + 7, white);
        g.line(px + 2, y + 3, px + 2, y + 7, ink);
      }
      // the deck: a thick yellow platform with a dark underside, and a red guard post at the slide's top
      g.fill(m, top, e - m + 1, 3, YELLOW);
      g.line(m, top - 1, e, top - 1, ink);
      g.line(m, top, e, top, white);
      g.line(m, top + 2, e, top + 2, [210, 170, 40]);
      g.line(m, top + 3, e, top + 3, ink);
      g.line(e, top - 10, e, top - 1, ink);
      g.line(e - 1, top - 10, e - 1, top - 1, RED);
      g.line(m, top - 10, m, top - 1, ink);
      g.line(m + 1, top - 10, m + 1, top - 1, RED);
    },
  };
}

// A sandbox: a gap in the street filled with sand. Ollie over it.
export function sandbox({ x, width }) {
  return pit(gap({ x, width }), x, width, (g, l, r, top, bottom) => {
    g.fill(l, top, r - l + 1, bottom - top, SAND);
    for (let px = l + 2; px < r - 1; px += 5) g.pset(px + ((px * 7) % 3), top + 3 + ((px * 5) % 9), WOOD);
    g.fill(l - 1, top - 2, 3, bottom - top + 2, WOOD); // wooden border either side
    g.fill(r - 1, top - 2, 3, bottom - top + 2, WOOD);
    g.line(l - 1, top - 2, l + 1, top - 2, ink);
    g.line(r - 1, top - 2, r + 1, top - 2, ink);
  });
}

// A ball pit: a wider gap full of coloured balls, heaped a little above the
// street. Falling in throws balls out (see Renderer.splash).
export function ballPit({ x, width }) {
  const base = pit(gap({ x, width }), x, width, (g, l, r, top, bottom) => {
    g.fill(l, top, r - l + 1, bottom - top, [60, 60, 120]);
    // rows of overlapping balls in eight colours, the top row bumpy
    for (let row = 0, by = top - 3; by < bottom; row++, by += 3) {
      const off = row % 2 ? 2 : 0;
      for (let bx = l + off - 1; bx < r; bx += 4) {
        const k = (bx * 7 + row * 5) % 8;
        const c = BALLS[k];
        const dy = row === 0 ? (bx * 3) % 3 : 0; // uneven heap
        const bw = Math.min(4, r - bx);
        if (bw < 2 || bx < l) continue;
        // a round ball: corners cut, a white glint top left, a darker rim bottom right
        const y0 = by + dy;
        g.fill(bx + 1, y0, Math.max(1, bw - 2), 4, c);
        g.fill(bx, y0 + 1, bw, 2, c);
        g.pset(bx + 1, y0 + 1, white);
        g.pset(bx + bw - 1, y0 + 2, ink);
        g.line(bx + 1, y0 + 3, bx + bw - 2, y0 + 3, [c[0] >> 1, c[1] >> 1, c[2] >> 1]);
      }
    }
    g.fill(l - 1, top - 3, 3, bottom - top + 3, RED);
    g.fill(r - 1, top - 3, 3, bottom - top + 3, RED);
  });
  return { ...base, splash: { x1: x, x2: x + width, y: WORLD.GROUND, kind: 'balls' } };
}

function pit(base, x, width, paint) {
  return {
    ...base,
    draw(g) {
      const top = P(WORLD.GROUND) + 5;
      paint(g, P(x), P(x + width) - 1, top, top + 80);
    },
  };
}

// A seesaw: a plank on a pivot. Ollie on and grind it like a rail: under your
// weight it tips about the pivot, the far end going down to the ground, so you
// ride it out downhill (see Game.updateSeesaw). Only its entry end is a wall.
export function seesaw({ x, length = 260, height = 42, base = WORLD.GROUND }) {
  const bar = rail({ x, length, height, base });
  const surface = { ...bar.surfaces[0], seesaw: { drop: height } };
  return {
    ...bar,
    type: 'seesaw',
    surfaces: [surface],
    solids: [{ x, y: base - height, w: 36, h: height }],
    draw(g, fx = {}) {
      const tilt = fx.tilt || 0;
      const [l, r] = [P(x), P(x + length)];
      const top = P(base - height);
      const b = P(base) - 1;
      const mid = (l + r) >> 1;
      const drop = Math.round(tilt * (b - top)); // pixels the far end has gone down
      // pivot: a triangle under the middle of the plank
      for (let i = 0; i < b - top - 2; i++) {
        const hw = Math.round((i * 9) / (b - top - 2)) + 1;
        g.line(mid - hw, top + 3 + i, mid + hw, top + 3 + i, steel);
        g.pset(mid - hw, top + 3 + i, ink);
        g.pset(mid + hw, top + 3 + i, ink);
      }
      g.line(mid - 10, b, mid + 10, b, ink);
      // the plank: a 3-pixel yellow board from (l, top - drop) to (r, top + drop)
      const plank = (a, c, colour) => {
        g.line(l, top - drop + a, r, top + drop + a, colour);
      };
      plank(0, 0, white);
      plank(1, 0, YELLOW);
      plank(2, 0, YELLOW);
      plank(-1, 0, ink);
      plank(3, 0, ink);
      // a handle at each end
      for (const [px, py, dir] of [[l, top - drop, 1], [r, top + drop, -1]]) {
        g.line(px, py, px, py - 3, ink);
        g.line(px + dir * 4, py - 3, px + dir * 4, py, RED);
      }
    },
  };
}

// Monkey bars: an arch frame with hanging rungs and the top bar to grind.
export function monkeyBars({ x, length = 380, height = 80, base = WORLD.GROUND }) {
  const bar = rail({ x, length, height, base });
  return {
    ...bar,
    type: 'monkey-bars',
    draw(g, fx) {
      const [l, r] = [P(x), P(x + length)];
      const top = P(base - height);
      const b = P(base) - 1;
      // two uprights
      for (const px of [l + 2, r - 2]) {
        g.line(px - 1, top + 3, px - 1, b, ink);
        g.line(px + 1, top + 3, px + 1, b, ink);
        g.line(px, top + 3, px, b, RED);
      }
      // rungs hanging from the bar
      for (let px = l + 10; px < r - 6; px += 9) {
        g.line(px, top + 3, px, top + 12, ink);
        g.line(px + 1, top + 3, px + 1, top + 12, steel);
      }
      pipe(g, l, top, r, top); // the grindable top bar
    },
  };
}

// A tower of toy blocks to ollie up onto: three steps of coloured blocks.
export function blockTower({ x, steps = 3, run = 45, rise = 28, base = WORLD.GROUND }) {
  const steppedUp = stepsUp({ x, steps, run, rise, base });
  return {
    ...steppedUp,
    type: 'block-tower',
    draw(g) {
      for (let i = 0; i < steps; i++) {
        const h = (i + 1) * rise;
        // each step's block sits on top of the one before
        drawBlock(g, P(x + i * run), P(base - h), P(x + (i + 1) * run) - 1, P(base - h + rise) - 1, COLORS[i % 4], i % 2 === 0);
      }
    },
  };
}

// A swing set standing behind the action: pure decor.
export function swingSet({ x, base = WORLD.GROUND, height = 150, width = 150 }) {
  return {
    type: 'swing-set',
    surfaces: [],
    solids: [],
    draw(g) {
      const [l, r] = [P(x), P(x + width)];
      const top = P(base - height);
      const b = P(base) - 1;
      // A-frame legs and the top bar
      g.line(l, b, (l + r) >> 1, top, ink);
      g.line((l + r) >> 1, top, r, b, ink);
      g.line(l + 1, b, ((l + r) >> 1) + 1, top, steel);
      g.line(((l + r) >> 1) - 1, top, r - 1, b, steel);
      g.line(l + 12, top, r - 12, top, ink);
      // two swings: chains and seats
      for (const sx of [((l + r) >> 1) - 10, ((l + r) >> 1) + 10]) {
        g.line(sx - 2, top, sx - 2, top + 28, ink);
        g.line(sx + 2, top, sx + 2, top + 28, ink);
        g.fill(sx - 3, top + 28, 7, 2, RED);
        g.rect(sx - 3, top + 28, 7, 2, ink);
      }
    },
  };
}
