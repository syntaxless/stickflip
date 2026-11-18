import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';
import { box } from './box.js';

const P = (v) => Math.round(v / 3);
const { ink, steel, shine, wheel: white } = PAL;

// An open-topped, lidless dumpster full of bin bags, in the same style as the trash can and hydrant:
// black outline, a lit left edge and a darker right edge, a light line under
// each dark rib, dents, rust and street grime, steel handles and wheels.
const BODY = [34, 128, 72];
const BODY_LIT = [78, 184, 110];
const BODY_DARK = [16, 82, 48];
const BODY_DEEP = [10, 56, 34];
const LID = [58, 84, 76];
const LID_LIT = [104, 134, 124];
const LID_DARK = [44, 68, 60];
const INSIDE = [12, 34, 24];
const RUST = [150, 82, 40];
const SOOT = [22, 28, 24];
const GRIME = [46, 58, 40];
const TAG = [236, 200, 60];
// Tied bin bags: a body colour, a lit patch top-left and a shaded underside.
const BLACK = { body: [38, 40, 52], lit: [104, 108, 128], dark: [18, 18, 26] };
const WHITE = { body: [226, 228, 236], lit: [255, 255, 255], dark: [160, 164, 184] };
const BLUE = { body: [56, 104, 196], lit: [124, 172, 240], dark: [32, 62, 134] };

// A tied bin bag: a bulging body, widest low down, with a flat bottom (so it sits
// on something instead of balancing on a point), gathered in to a knotted neck
// with two floppy ears. Dark plastic with a few lighter crinkle highlights, a
// shaded lower right and a black outline. `lean` slides the top sideways.
function trashBag(g, cx, bottom, w, h, c, lean = 0) {
  const rx = w / 2;
  const neckRows = 2;
  const top = bottom - h + 1;
  const bodyH = h - neckRows;
  const mid = (y) => cx + (lean * (bottom - y)) / (h - 1);
  const half = (y) => {
    if (y < top + neckRows) return 1.5; // the gathered neck
    const k = (bottom - y) / (bodyH - 1); // 0 at the bottom of the body, 1 under the neck
    const hw = k < 0.5 ? rx : rx * (1 - ((k - 0.5) / 0.5) ** 1.8 * 0.6);
    return y === bottom ? hw - 1 : hw; // the bottom corners are clipped a pixel
  };
  const inBag = (x, y) => y >= top && y <= bottom && Math.abs(x - mid(y)) <= half(y);
  for (let y = top; y <= bottom; y++) {
    for (let x = Math.floor(cx - rx - Math.abs(lean)) - 1; x <= Math.ceil(cx + rx + Math.abs(lean)) + 1; x++) {
      if (!inBag(x, y)) continue;
      const edge = !inBag(x - 1, y) || !inBag(x + 1, y) || !inBag(x, y - 1) || !inBag(x, y + 1);
      const dx = x - mid(y);
      const shade = dx > rx * 0.45 || y > bottom - 2;
      g.pset(x, y, edge ? ink : shade ? c.dark : c.body);
    }
  }
  // crinkle highlights: short light streaks down the lit side, in fixed spots
  for (const [fx, fy, len] of [[-0.5, 0.42, 3], [-0.15, 0.3, 2], [-0.62, 0.7, 2], [0.1, 0.62, 2]]) {
    const hx = Math.round(mid(bottom - fy * bodyH) + fx * rx);
    const hy = Math.round(bottom - fy * bodyH);
    for (let i = 0; i < len; i++) if (inBag(hx + (i >> 1), hy + i) && !(i === 0 && !inBag(hx, hy - 1))) g.pset(hx + (i >> 1), hy + i, c.lit);
  }
  // the knot: a gathered tuft with an ear flopping out each side
  const kx = Math.round(mid(top));
  g.pset(kx - 1, top - 1, ink);
  g.pset(kx, top - 1, c.body);
  g.pset(kx + 1, top - 1, ink);
  g.pset(kx - 2, top, ink); // left ear
  g.pset(kx - 2, top + 1, c.lit);
  g.pset(kx + 2, top, ink); // right ear
  g.pset(kx + 2, top + 1, c.body);
}

// The fire: red, orange, yellow and cream steps, flickering over six frames at
// about nine a second. Scenery only. `front` draws the short tongues that lick over
// the bags along the rim; the tall flames are drawn first, behind the bags.
const FIRE = { red: [214, 54, 58], orange: [250, 150, 40], yellow: [255, 214, 90], cream: [255, 244, 190] };
const hash = (a, b) => (((a * 374761393 + b * 668265263) ^ (a * 2246822519)) >>> 0) % 1000;
function flames(g, l, r, base, time, tall, front) {
  const frame = Math.floor(time * 9) % 6;
  const span = r - l;
  for (let x = l + 2; x <= r - 2; x++) {
    const u = (x - l) / span; // 0..1 across the opening
    const profile = tall ? 0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, Math.max(0, u * 0.9 + 0.05))) : 1;
    const n = hash(x >> 1, frame + (front ? 11 : 0)) / 1000;
    const flicker = 0.55 + 0.45 * n;
    const hgt = Math.round((tall ? 21 : 4) * profile * flicker);
    if (!hgt || (front && n < 0.25)) continue; // gaps in the low tongues let the bags show
    for (let i = 0; i < hgt; i++) {
      const f = i / Math.max(1, hgt - 1); // 0 at the bottom of the column, 1 at the tip
      const col = f < 0.3 ? FIRE.cream : f < 0.55 ? FIRE.yellow : f < 0.8 ? FIRE.orange : FIRE.red;
      // ragged edges: the outer columns lose their lower pixels on some frames
      if ((x === l + 2 || x === r - 2) && hash(x, frame + i) < 450) continue;
      g.pset(x, base - i, col);
    }
  }
}

// Ollie over it or grind the front top edge with a
// timed tap (like a rail). Landing on it without a grind clips you, and its sides slam you.
export function dumpster({ x, w = 150, h = 96, base = WORLD.GROUND }) {
  const b0 = box({ x, w, h, landable: false, grindable: true, base });
  return {
    ...b0,
    type: 'dumpster',
    draw(g, fx = {}) {
      const time = fx.time || 0;
      const [l, t, r, b] = [P(x), P(base - h), P(x + w) - 1, P(base) - 1];
      const wheelTop = b - 2;
      const bodyBottom = wheelTop - 1;
      const span = r - l;

      // ---- No lid: the back of the bin, then bags of rubbish bulging over the rim.
      g.fill(l + 1, t - 4, span - 1, 4, INSIDE);
      g.line(l + 1, t - 4, r - 1, t - 4, ink);
      g.line(l + 2, t - 3, r - 2, t - 3, BODY_DARK); // the back rim, just visible
      flames(g, l, r, t - 4, time, true, false); // the tall flames, behind the bags
      // Three chunky bags dumped in a heap, overlapping at different heights and angles:
      // [centre x from the left, bottom above the rim, width, height, lean, bag], back to front.
      for (const [bx, lift, bw, bh, lean, bag] of [
        [10, 0, 16, 15, -2, BLACK], [28, 0, 15, 16, 2, BLUE], [41, 1, 13, 12, -3, BLACK],
      ]) trashBag(g, l + bx, t + 1 - lift, bw, bh, bag, lean);
      flames(g, l, r, t - 1, time, false, true); // short tongues licking over the bags along the rim

      // ---- Body: flat colour with a lit left edge, a shaded right edge and a shaded foot.
      g.fill(l, t, span + 1, bodyBottom - t + 1, BODY);
      g.line(l, t, r, t, BODY_LIT);
      g.line(l, t + 1, r, t + 1, BODY_LIT); // the rim you grind along
      g.line(l, t + 2, r, t + 2, BODY_DARK);
      g.line(l + 1, t + 3, l + 3, t + 3, BODY_LIT);
      g.fill(l + 1, t + 3, 2, bodyBottom - t - 3, BODY_LIT); // lit left edge
      g.fill(r - 2, t + 3, 2, bodyBottom - t - 3, BODY_DARK); // shaded right edge
      g.line(l, bodyBottom, r, bodyBottom, BODY_DEEP);
      g.line(l, bodyBottom - 1, r, bodyBottom - 1, BODY_DARK);
      for (const y of [t + 11, t + 21]) {
        g.line(l + 3, y, r - 3, y, BODY_DARK);
        g.line(l + 3, y + 1, r - 3, y + 1, BODY_DEEP);
        g.line(l + 3, y + 2, r - 3, y + 2, BODY_LIT); // light catching the lower edge of the rib
      }
      for (const sx of [l + 16, l + 33]) g.line(sx, t + 3, sx, t + 10, BODY_DARK); // panel seams
      // dents: a dark patch with a lit edge below
      for (const [dx, dy, dw] of [[l + 6, t + 4, 5], [r - 14, t + 25, 6]]) {
        g.line(dx, dy, dx + dw - 1, dy, BODY_DARK);
        g.line(dx + 1, dy + 1, dx + dw - 1, dy + 1, BODY_DARK);
        g.line(dx, dy + 2, dx + dw - 2, dy + 2, BODY_LIT);
      }
      // rust bleeding down from the rim and the ribs
      for (const [rx, ry, rl] of [[l + 9, t + 3, 6], [l + 27, t + 12, 4], [r - 8, t + 3, 5], [l + 40, t + 22, 3]]) {
        g.line(rx, ry, rx, ry + rl - 1, RUST);
        g.pset(rx + 1, ry + 2, RUST);
      }
      // street grime thickening toward the foot, in fixed spots
      for (let gx = l + 3; gx < r - 2; gx++) {
        const hsh = (gx * 37 + 11) % 7;
        if (hsh < 3) g.pset(gx, bodyBottom - 2 - (hsh % 2), GRIME);
        if (hsh === 0) g.pset(gx, bodyBottom - 4, GRIME);
      }
      // scorch: soot speckled along the rim and streaked up from it, darker toward the middle
      for (let sx = l + 2; sx < r - 1; sx++) {
        const h2 = hash(sx, 7);
        const mid = 1 - Math.abs((sx - (l + r) / 2) / (span / 2));
        if (h2 < 160 + 280 * mid) g.pset(sx, t + 2, BODY_DEEP);
        if (h2 < 120 + 220 * mid) g.pset(sx, t + 3, SOOT);
        if (h2 < 70 + 150 * mid) g.fill(sx, t + 4, 1, 2 + (h2 % 4), SOOT); // a streak running down
        if (h2 > 880 - 100 * mid) g.pset(sx, t + 1, SOOT); // soot on the lit rim
      }
      // the front plate
      g.fill(r - 20, t + 14, 12, 5, TAG);
      g.rect(r - 20, t + 14, 12, 5, ink);
      g.line(r - 18, t + 16, r - 10, t + 16, BODY_DARK);
      g.line(r - 19, t + 15, r - 12, t + 15, [255, 240, 150]);
      g.rect(l, t, span + 1, bodyBottom - t + 1, ink);
      g.line(l, t - 1, r, t - 1, ink); // outline above the rim

      // ---- Handles on each end: steel loops with a bright grip.
      for (const [hx, dir] of [[l, -1], [r, 1]]) {
        const ex = hx + dir * 3;
        g.line(hx, t + 8, ex, t + 8, ink);
        g.line(hx, t + 16, ex, t + 16, ink);
        g.line(ex, t + 8, ex, t + 16, ink);
        g.line(hx + dir, t + 9, hx + dir * 2, t + 9, steel);
        g.line(hx + dir * 2, t + 9, hx + dir * 2, t + 15, steel);
        g.pset(hx + dir * 2, t + 10, shine);
      }
      // ---- Wheels: black tyres with a bright hub.
      for (const wx of [l + 6, r - 9]) {
        g.fill(wx, wheelTop, 4, 3, ink);
        g.pset(wx + 1, wheelTop + 1, steel);
        g.pset(wx + 2, wheelTop, white);
      }
    },
  };
}

// A bin bag dumped on the street: scenery only, with no surfaces or solids, so it
// can never slam you or change a jump (you roll and ollie straight over it).
export function groundBag({ x, base = WORLD.GROUND }) {
  return {
    type: 'ground-bag',
    surfaces: [],
    solids: [],
    draw(g) {
      trashBag(g, P(x), P(base) - 1, 12, 11, BLUE, 1);
    },
  };
}
