import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';
import { box } from './box.js';

const P = (v) => Math.round(v / 3);
const { ink, steel, shine, wheel: white } = PAL;

// A shaded green dumpster, in the same style as the trash can and hydrant:
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
const BAGS = [[150, 70, 160], [236, 220, 120], [200, 50, 50], [210, 210, 218], [90, 150, 200], [236, 220, 120], [150, 70, 160], [200, 50, 50]];

// The lid is hinged along the back rim and swings up and back (fx.open is the
// seconds since a grind on the rim began, or null while it is shut). It is
// scenery either way: only the box below has a hitbox.
const SWING = 0.34; // seconds to swing open
const OPEN_DEG = 106; // a little past upright, so you see the lid's underside
function lidAngle(age) {
  if (age === null) return 0;
  const k = Math.min(1, age / SWING);
  const ease = 1 - (1 - k) * (1 - k); // fast off the mark, slowing as it opens
  const bounce = k >= 1 ? Math.max(0, Math.sin((age - SWING) * 22)) * Math.exp(-(age - SWING) * 9) * 5 : 0;
  return OPEN_DEG * ease - bounce;
}

// Ollie over it, land on it and roll off, or grind the front top edge with a
// timed tap (like a rail). Its sides slam you.
export function dumpster({ x, w = 150, h = 96, base = WORLD.GROUND }) {
  const b0 = box({ x, w, h, landable: true, grindable: true, base });
  b0.surfaces[0].opens = true;
  return {
    ...b0,
    type: 'dumpster',
    draw(g, fx = {}) {
      const deg = lidAngle(fx.open ?? null);
      const th = (deg * Math.PI) / 180;
      const [l, t, r, b] = [P(x), P(base - h), P(x + w) - 1, P(base) - 1];
      const wheelTop = b - 2;
      const bodyBottom = wheelTop - 1;
      const hinge = t - 8; // the back rim, as seen from just above
      const span = r - l;

      // ---- Inside of the bin: back wall, then a pile of rubbish rising over the rim.
      g.fill(l + 1, hinge, span - 1, t - 1 - hinge, INSIDE);
      g.line(l + 1, hinge, r - 1, hinge, ink);
      g.line(l + 2, hinge + 1, r - 2, hinge + 1, BODY_DARK); // the back rim's lit edge
      let px = l + 3;
      for (let i = 0; px + 5 < r - 2; i++) {
        const bw = 4 + ((i * 5) % 3);
        const bh = 3 + ((i * 7) % 4);
        const top = t - 2 - bh;
        const c = BAGS[i % BAGS.length];
        g.fill(px, top, bw, t - 2 - top, c);
        g.line(px, top, px + bw - 1, top, ink);
        g.pset(px, top + 1, shine);
        g.pset(px + bw - 1, top + 1, ink);
        px += bw + 1;
      }
      g.line(l + 1, t - 2, r - 1, t - 2, ink);

      // ---- The lid: a quad from the hinge (fixed) to its swinging front edge.
      const lift = Math.round(5 * Math.cos(th) - 15 * Math.sin(th)); // front edge relative to the hinge
      const yFront = hinge + lift;
      const [ya, yb] = [Math.min(yFront, hinge), Math.max(yFront, hinge)];
      const inside = deg > 90; // swung past upright: we see the lid's underside
      for (let y = ya; y <= yb; y++) {
        const up = Math.max(0, hinge - y);
        const inset = 2 + Math.floor(up / 4);
        const edge = y === ya;
        g.line(l + inset, y, r - inset, y, edge ? (inside ? LID : LID_LIT) : inside ? LID_DARK : LID);
        g.pset(l + inset - 1, y, ink);
        g.pset(r - inset + 1, y, ink);
        if (y > ya + 1 && y < yb) {
          g.pset(l + inset, y, inside ? LID : LID_LIT); // lit left edge
          g.pset(r - inset, y, inside ? INSIDE : BODY_DARK); // shaded right edge
        }
      }
      const topInset = 2 + Math.floor(Math.max(0, hinge - ya) / 4);
      g.line(l + topInset, ya - 1, r - topInset, ya - 1, ink);
      g.line(l + 2, yb + 1, r - 2, yb + 1, ink);
      if (yb - ya > 3) for (const gx of [l + 12, Math.round((l + r) / 2), r - 12]) g.line(gx, ya + 2, gx, yb - 1, inside ? LID : LID_DARK); // ribs
      if (deg < 50) g.line(l + 3, yFront, r - 3, yFront, LID_LIT); // lit front lip of a closed lid

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
