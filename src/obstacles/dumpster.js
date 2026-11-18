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
const GRIME = [46, 58, 40];
const TAG = [236, 200, 60];
// Tied bin bags: a body colour, a lit patch top-left and a shaded underside.
const BLACK = { body: [38, 40, 52], lit: [104, 108, 128], dark: [18, 18, 26] };
const WHITE = { body: [226, 228, 236], lit: [255, 255, 255], dark: [160, 164, 184] };
const BLUE = { body: [56, 104, 196], lit: [124, 172, 240], dark: [32, 62, 134] };

// A tied bin bag: a lumpy ellipse with a black outline, a lit patch, a shaded
// lower right, and a knot with two ears on top. Its bottom half hides behind the rim.
function trashBag(g, cx, bottom, w, h, c) {
  const [rx, ry] = [w / 2, h / 2];
  const cy = bottom - ry;
  const inBag = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  for (let y = Math.floor(cy - ry); y <= bottom; y++) {
    for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx) + 1; x++) {
      if (!inBag(x, y)) continue;
      const edge = !inBag(x - 1, y) || !inBag(x + 1, y) || !inBag(x, y - 1) || !inBag(x, y + 1);
      const lit = x < cx - rx * 0.1 && y < cy - ry * 0.15 && x > cx - rx * 0.75 && y > cy - ry * 0.8;
      const shade = x > cx + rx * 0.35 || y > cy + ry * 0.45;
      g.pset(x, y, edge ? ink : lit ? c.lit : shade ? c.dark : c.body);
    }
  }
  const kx = Math.round(cx);
  const ky = Math.floor(cy - ry);
  g.pset(kx, ky - 1, c.body); // the tied-off neck, with one ear flopping over
  g.pset(kx + 1, ky - 2, c.body);
  g.pset(kx, ky - 2, ink);
  g.pset(kx + 2, ky - 2, ink);
  g.pset(kx - 1, ky - 1, ink);
  g.pset(kx + 1, ky - 3, ink);
}

// Ollie over it, land on it and roll off, or grind the front top edge with a
// timed tap (like a rail). Its sides slam you.
export function dumpster({ x, w = 150, h = 96, base = WORLD.GROUND }) {
  const b0 = box({ x, w, h, landable: true, grindable: true, base });
  return {
    ...b0,
    type: 'dumpster',
    draw(g) {
      const [l, t, r, b] = [P(x), P(base - h), P(x + w) - 1, P(base) - 1];
      const wheelTop = b - 2;
      const bodyBottom = wheelTop - 1;
      const span = r - l;

      // ---- No lid: the back of the bin, then bags of rubbish bulging over the rim.
      g.fill(l + 1, t - 4, span - 1, 4, INSIDE);
      g.line(l + 1, t - 4, r - 1, t - 4, ink);
      g.line(l + 2, t - 3, r - 2, t - 3, BODY_DARK); // the back rim, just visible
      // Four chunky bags, piled up high on the left and sloping down to the right:
      // [centre x from the left, bottom above the rim, width, height, bag]
      for (const [bx, lift, bw, bh, bag] of [
        [9, 0, 15, 13, BLACK], [23, 0, 15, 12, BLUE], [38, 0, 14, 9, WHITE], [14, 9, 13, 11, WHITE],
      ]) trashBag(g, l + bx, t + 1 - lift, bw, bh + 1, bag);

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
      trashBag(g, P(x), P(base) - 1, 12, 9, BLUE);
    },
  };
}
