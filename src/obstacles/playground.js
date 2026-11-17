import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';
import { box } from './box.js';
import { rail } from './rail.js';
import { gap } from './gap.js';
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

// A playground slide: a tall platform (a solid block you ollie up onto, or over)
// and a yellow chute running down from its right edge, curving out flat at the
// bottom. Ollie from the ground and lock onto the chute to grind it down (hold
// your finger or tap just before you land on it). Land on the platform instead
// and roll off its end with the finger held to lock on, or let go and you clip
// the chute. The chute's end drops onto a short flat lip.
export function playSlide({ x, deckW = 90, deckH = 96, run = 210, drop = 62, base = WORLD.GROUND }) {
  const deck = box({ x, w: deckW, h: deckH, landable: true, base });
  const [x1, y1] = [x + deckW, base - deckH];
  const [x2, y2] = [x1 + run, y1 + drop];
  const lipY = base - 20; // the flat lip at the bottom of the curve
  const chute = { x1, x2, y1, y2, grindable: true, landable: false };
  const lip = { x1: x2, x2: x2 + 150, y: lipY, grindable: false, landable: true };
  return {
    type: 'slide',
    surfaces: [chute, lip, ...deck.surfaces],
    solids: deck.solids,
    draw(g) {
      const [a, b, c, d] = [P(x1), P(y1), P(x2), P(y2)];
      const floor = P(base) - 1;
      const [dl, dt, dr] = [P(x), P(base - deckH), P(x1) - 1];
      const yAt = (px) => b + Math.round(((px - a) * (d - b)) / Math.max(1, c - a));
      // the platform: a blue block with plank lines, a yellow top and a red guard post
      g.fill(dl, dt, dr - dl + 1, floor - dt + 1, BLUE);
      g.rect(dl, dt, dr - dl + 1, floor - dt + 1, ink);
      for (let y = dt + 8; y < floor - 2; y += 8) g.line(dl + 1, y, dr - 1, y, [60, 60, 190]);
      g.line(dl + 1, dt + 2, dl + 1, floor - 1, [150, 150, 255]);
      g.fill(dl - 1, dt - 3, dr - dl + 3, 3, YELLOW);
      g.rect(dl - 1, dt - 3, dr - dl + 3, 3, ink);
      g.line(dl + 2, dt - 4, dr - 2, dt - 4, white);
      // legs under the chute: a post every ~28 px, down to the ground
      for (let px = a + 14; px < c - 6; px += 28) {
        g.line(px, yAt(px) + 3, px, floor, ink);
        g.line(px + 1, yAt(px) + 3, px + 1, floor, steel);
        g.line(px + 2, yAt(px) + 3, px + 2, floor, ink);
      }
      // the curve at the bottom: the chute eases out flat onto the lip
      const lip0 = P(lipY);
      const cl = Math.max(30, Math.round((2 * (lip0 - d)) / Math.max(0.05, (d - b) / Math.max(1, c - a)))); // px the curve takes to flatten
      const yCurve = (px) => {
        const t = Math.min(1, (px - c) / cl);
        const slope = (d - b) / Math.max(1, c - a);
        return Math.round(d + slope * cl * t + (lip0 - d - slope * cl) * t * t);
      };
      const chuteLine = (px, y) => {
        g.pset(px, y - 3, ink);
        g.pset(px, y - 2, white);
        g.pset(px, y - 1, YELLOW);
        g.pset(px, y, YELLOW);
        g.pset(px, y + 1, [210, 170, 40]);
        g.pset(px, y + 2, ink);
      };
      for (let px = a; px < c; px++) chuteLine(px, yAt(px));
      for (let px = c; px < c + cl + 14; px++) chuteLine(px, px < c + cl ? yCurve(px) : lip0);
      // the side rail along the chute: a red tube with posts
      for (let px = a; px < c; px++) g.pset(px, yAt(px) - 11, px % 2 ? RED : ink);
      for (const px of [a + 2, Math.round((a + c) / 2), c - 2]) g.line(px, yAt(px) - 11, px, yAt(px) - 3, RED);
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
export function blockTower({ x, w = 96, h = 100, base = WORLD.GROUND }) {
  const top = box({ x, w, h, landable: true, base });
  return {
    ...top,
    type: 'block-tower',
    draw(g) {
      // three toy blocks piled up, each a little off-centre and a different size,
      // with a letter on the face (A, B, C) and a small block perched on top
      const [l, r, b] = [P(x), P(x + w) - 1, P(base) - 1];
      const bh = Math.round(P(h) / 3);
      const rows = [
        { l, r, c: RED, ch: 'A' }, // the big bottom block
        { l: l + 1, r: r - 3, c: YELLOW, ch: 'B' }, // shifted left, a bit narrower
        { l: l + 3, r: r - 1, c: BLUE, ch: 'C' }, // shifted right
      ];
      rows.forEach((row, i) => {
        const bottom = b - i * bh;
        const t = bottom - bh + 1;
        drawBlock(g, row.l, t, row.r, bottom, row.c, false);
        // a little depth: a lit strip along the top and a shaded strip down the right
        g.line(row.l + 1, t + 1, row.r - 1, t + 1, [255, 255, 255]);
        g.line(row.r - 1, t + 2, row.r - 1, bottom - 1, row.c.map((v) => Math.round(v * 0.65)));
        g.line(row.l + 1, bottom - 1, row.r - 1, bottom - 1, row.c.map((v) => Math.round(v * 0.65)));
        // the letter, in white on the dark colours and dark red on the yellow
        const cx = Math.round((row.l + row.r) / 2) - 2;
        g.text(row.ch, cx, t + Math.round((bh - 7) / 2) + 1, row.c === YELLOW ? [170, 0, 0] : white);
      });
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
