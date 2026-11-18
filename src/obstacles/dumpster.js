import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';
import { box } from './box.js';

const P = (v) => Math.round(v / 3);
const { ink, steel, shine } = PAL;

// The lid starts shut and pops open once you grind the rim (fx.open is the
// seconds since the grind began, or null before it); it is scenery either way.
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
  const surface = b0.surfaces[0];
  surface.opens = true;
  return {
    ...b0,
    type: 'dumpster',
    draw(g, fx = {}) {
      const age = fx.open ?? null;
      const amount = age === null ? 0 : age < 0.06 ? 0.3 : age < 0.14 ? 0.7 : 1;
      const [l, t, r, b] = [P(x), P(base - h), P(x + w) - 1, P(base) - 1];
      const wheelTop = b - 2;
      const bodyBottom = wheelTop - 1;

      if (amount === 0) {
        // Shut: a flat dark slab over the rim with a lit top and a seam.
        g.fill(l - 1, t - 5, r - l + 3, 4, LID);
        g.line(l - 1, t - 5, r + 1, t - 5, LID_LIT);
        g.line(l - 1, t - 1, r + 1, t - 1, INSIDE);
        g.rect(l - 1, t - 6, r - l + 3, 6, ink);
        g.line(l, t - 5, r, t - 5, LID_LIT);
        for (const px of [l + 12, Math.round((l + r) / 2), r - 12]) g.line(px, t - 4, px, t - 2, INSIDE);
      } else {
        // Open, tipped well back: the dark inside of the bin shows between
        // the rim and the lid, with a lumpy pile of rubbish in it.
        const rise = Math.round(7 * amount); // height of the opening above the rim
        const lidH = Math.round(14 * amount);
        const base = t - 2 - rise; // where the lid hinges (its lower edge)
        g.fill(l + 1, base, r - l - 1, rise + 2, INSIDE);
        g.line(l + 2, t - 2, r - 2, t - 2, ink);
        g.line(l + 1, base, l + 1, t - 2, ink);
        g.line(r - 1, base, r - 1, t - 2, ink);
        if (amount === 1) {
          const bags = [
            [l + 4, 8, 4, [150, 70, 160]], [l + 11, 7, 6, [236, 220, 120]], [l + 19, 9, 3, [200, 50, 50]],
            [l + 25, 6, 5, [210, 210, 218]], [l + 32, 8, 5, [90, 150, 200]], [l + 39, 7, 4, [236, 220, 120]],
            [r - 9, 8, 6, [150, 70, 160]], [r - 16, 6, 5, [200, 50, 50]],
          ];
          for (const [px, bh, bw, c] of bags) {
            const top = t - 2 - Math.min(bh, rise + 1);
            g.fill(px, top, bw, t - 2 - top, c);
            g.line(px, top, px + bw - 1, top, ink);
            g.pset(px, top + 1, shine);
          }
        }
        // the lid, standing up behind: a trapezoid narrower at the top
        for (let i = 0; i < lidH; i++) {
          const y = base - 1 - i;
          const inset = 2 + Math.floor(i / 3);
          g.line(l + inset, y, r - inset, y, i === lidH - 1 ? LID_LIT : LID);
          g.pset(l + inset - 1, y, ink);
          g.pset(r - inset + 1, y, ink);
        }
        g.line(l + 2, base, r - 2, base, ink);
        g.line(l + 5, base - 1 - lidH, r - 5, base - 1 - lidH, ink);
        if (amount === 1) for (const px of [l + 12, Math.round((l + r) / 2), r - 12]) g.line(px, base - lidH + 1, px, base - 3, LID_LIT); // lid ribs
      }

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
      if (amount > 0) g.line(l, t - 1, r, t - 1, ink); // outline above the rim

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
