import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';
import { box } from './box.js';

const P = (v) => Math.round(v / 3);
const { ink, steel, shine } = PAL;

// A flat-colour green dumpster: black outline, a lit rim along the front top
// edge, two dark ribs, handles on each end, little wheels, and a dark lid
// propped open behind the rim with some rubbish peeking over.
const BODY = [34, 128, 72];
const BODY_LIT = [70, 176, 104];
const BODY_DARK = [16, 82, 48];
const LID = [52, 76, 68];
const LID_LIT = [92, 120, 110];
const INSIDE = [12, 34, 24];
const TAG = [236, 200, 60];

// Ollie over it, land on it and roll off, or grind the front top edge with a
// timed tap (like a rail). Its sides slam you; the open lid is only scenery.
export function dumpster({ x, w = 150, h = 96, base = WORLD.GROUND }) {
  const b0 = box({ x, w, h, landable: true, grindable: true, base });
  return {
    ...b0,
    type: 'dumpster',
    draw(g) {
      const [l, t, r, b] = [P(x), P(base - h), P(x + w) - 1, P(base) - 1];
      const wheelTop = b - 2;
      const bodyBottom = wheelTop - 1;

      // The lid, tipped back: a trapezoid behind the rim, narrower at the top.
      const lidH = 10;
      for (let i = 0; i < lidH; i++) {
        const y = t - 2 - i;
        const inset = 2 + Math.floor(i / 3);
        g.line(l + inset, y, r - inset, y, i === lidH - 1 ? LID_LIT : LID);
        g.pset(l + inset - 1, y, ink);
        g.pset(r - inset + 1, y, ink);
      }
      g.line(l + 5, t - 2 - lidH, r - 5, t - 2 - lidH, ink);
      for (const px of [l + 12, Math.round((l + r) / 2), r - 12]) g.line(px, t - 2 - lidH + 2, px, t - 4, LID_LIT); // lid ribs
      // dark inside of the bin between lid and rim, with rubbish peeking out
      g.line(l + 2, t - 1, r - 2, t - 1, INSIDE);
      g.line(l + 2, t - 2, r - 2, t - 2, ink);
      const junk = [[l + 10, 2, [150, 70, 160]], [l + 19, 1, [236, 220, 120]], [r - 16, 2, [200, 50, 50]], [r - 26, 1, [236, 220, 120]]];
      for (const [px, hh, c] of junk) g.fill(px, t - 1 - hh, 3, hh, c);

      // Body: flat colour, lit rim (the grind line), ribs, shaded foot.
      g.fill(l, t, r - l + 1, bodyBottom - t + 1, BODY);
      g.line(l, t, r, t, BODY_LIT);
      g.line(l, t + 1, r, t + 1, BODY_LIT);
      g.line(l, t + 2, r, t + 2, BODY_DARK);
      for (const y of [t + 11, t + 21]) {
        g.line(l + 2, y, r - 2, y, BODY_DARK);
        g.line(l + 2, y + 1, r - 2, y + 1, BODY_DARK);
      }
      g.line(l, bodyBottom, r, bodyBottom, BODY_DARK);
      g.fill(l + 3, t + 5, 1, 4, BODY_LIT); // a glint down the left edge
      g.fill(r - 17, t + 14, 11, 5, TAG); // a plate on the front
      g.rect(r - 17, t + 14, 11, 5, ink);
      g.line(r - 15, t + 16, r - 9, t + 16, BODY_DARK);
      g.rect(l, t, r - l + 1, bodyBottom - t + 1, ink);
      g.line(l, t - 1, r, t - 1, ink); // outline above the rim

      // Handles on each end: little black loops with a grey grip.
      for (const [hx, dir] of [[l, -1], [r, 1]]) {
        const ex = hx + dir * 3;
        g.line(hx, t + 9, ex, t + 9, ink);
        g.line(hx, t + 15, ex, t + 15, ink);
        g.line(ex, t + 9, ex, t + 15, ink);
        g.line(hx + dir, t + 10, hx + dir * 2, t + 10, steel);
      }
      // Wheels: grey with a bright centre, a black foot under each end.
      for (const wx of [l + 6, r - 9]) {
        g.fill(wx, wheelTop, 4, 3, ink);
        g.pset(wx + 1, wheelTop + 1, shine);
      }
    },
  };
}
