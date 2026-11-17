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

// A slide's yellow chute, drawn along a straight slope from (x1, y1) to (x2, y2).
export function slideChute({ x1, y1, x2, y2 }) {
  return {
    type: 'slide',
    surfaces: [],
    solids: [],
    draw(g) {
      const [a, b, c, d] = [P(x1), P(y1), P(x2), P(y2)];
      g.line(a, b - 3, c, d - 3, ink);
      g.line(a, b - 2, c, d - 2, YELLOW);
      g.line(a, b - 1, c, d - 1, YELLOW);
      g.line(a, b, c, d, ink);
      // side rail and a post at the top
      g.line(a, b - 8, a, b, ink);
      g.line(a + 1, b - 8, a + 1, b, RED);
      g.line(a, b - 8, a + 12, b - 8, ink);
      g.line(a, b - 7, a + 12, b - 7, RED);
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

// A ball pit: a wider gap full of coloured balls.
export function ballPit({ x, width }) {
  return pit(gap({ x, width }), x, width, (g, l, r, top, bottom) => {
    g.fill(l, top, r - l + 1, bottom - top, [60, 60, 120]);
    for (let by = top + 2; by < bottom; by += 4) {
      for (let bx = l + 2 + (((by - top) / 4) % 2) * 2; bx < r - 1; bx += 4) {
        const c = COLORS[(bx * 3 + by) % 4];
        g.fill(bx, by, 3, 3, c);
        g.pset(bx, by, white);
      }
    }
    g.fill(l - 1, top - 3, 3, bottom - top + 3, RED);
    g.fill(r - 1, top - 3, 3, bottom - top + 3, RED);
  });
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

// A seesaw: a plank on a pivot, level. Ollie on and grind it like a rail.
export function seesaw({ x, length = 260, height = 42, base = WORLD.GROUND }) {
  const bar = rail({ x, length, height, base });
  return {
    ...bar,
    type: 'seesaw',
    draw(g) {
      const [l, r] = [P(x), P(x + length)];
      const top = P(base - height);
      const b = P(base) - 1;
      const mid = (l + r) >> 1;
      // pivot: a triangle under the middle of the plank
      for (let i = 0; i < b - top - 2; i++) {
        const hw = Math.round((i * 9) / (b - top - 2)) + 1;
        g.line(mid - hw, top + 3 + i, mid + hw, top + 3 + i, steel);
        g.pset(mid - hw, top + 3 + i, ink);
        g.pset(mid + hw, top + 3 + i, ink);
      }
      g.line(mid - 10, b, mid + 10, b, ink);
      // the plank, yellow with a lit top and a handle at each end
      g.fill(l, top, r - l + 1, 3, YELLOW);
      g.line(l, top, r, top, white);
      g.rect(l, top, r - l + 1, 3, ink);
      g.line(l, top, l, top - 2, ink);
      g.line(r, top, r, top - 2, ink);
      g.line(l + 4, top - 3, l + 4, top, RED);
      g.line(r - 4, top - 3, r - 4, top, RED);
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
