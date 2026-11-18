import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';

const { ink, steel, shine, wheel: white } = PAL;

// A red painted curb: lit top, red face, darker foot, chipped to the concrete.
const CURB = { lit: [255, 120, 100], red: [205, 40, 40], dark: [140, 20, 30], chip: [225, 215, 205] };

const SLAPPY_MAX = 36; // the tallest curb you can slap onto without an ollie

// A block standing on the street: a curb, a trash can. Its sides slam you if
// you hit them, so ollie over it. A `landable` top can be landed on and rolled
// across (roll off the end and you drop back down); a `grindable` one can be
// ground with a timed tap, like a rail, and if it's low enough, slappied:
// ridden straight into with the finger held, no ollie. Anything else on top is a bail.
export function box({ x, w, h, landable = false, grindable = false, lid = false, paint = null, base = WORLD.GROUND }) {
  const top = base - h;
  const surface = { x1: x, x2: x + w, y: top, landable, grindable };
  return {
    type: 'box',
    surfaces: [surface],
    // A low grindable box (a curb) can be slappied: see Game.update.
    solids: [{ x, y: top, w, h, slappy: grindable && h <= SLAPPY_MAX ? surface : null }],
    draw(g) {
      const P = (v) => Math.round(v / 3);
      const [l, t, r, b] = [P(x), P(top), P(x + w) - 1, P(base) - 1];
      if (paint === 'bench') {
        // A wooden park bench: slatted backrest behind, plank seat on top (the grind line), iron legs.
        const [wl, wm, wd, iron] = [[210, 140, 70], [176, 108, 50], [120, 68, 28], [60, 60, 70]];
        const back = t - 9;
        for (const px of [l + 3, r - 4]) g.fill(px, back, 2, 10, iron); // backrest uprights
        for (const [y, c] of [[back, wl], [back + 4, wm]]) { // two backrest slats, outlined
          g.fill(l + 1, y, r - l - 1, 3, c);
          g.rect(l + 1, y - 1, r - l - 1, 5, ink);
          g.line(l + 2, y, r - 2, y, wl);
        }
        g.fill(l, t, r - l + 1, 5, wm); // seat planks
        g.rect(l, t, r - l + 1, 5, ink);
        g.line(l + 1, t + 1, r - 1, t + 1, wl);
        g.line(l + 1, t + 3, r - 1, t + 3, wd); // the gap between planks
        for (let px = l + 6; px < r - 4; px += 11) g.pset(px, t + 2, wd); // grain
        for (const px of [l + 4, r - 5]) { // iron legs with a foot
          g.fill(px, t + 5, 3, b - t - 4, iron);
          g.rect(px - 1, t + 5, 5, b - t - 3, ink);
          g.fill(px, t + 6, 3, b - t - 5, iron);
          g.line(px, t + 6, px, b - 1, shine);
          g.line(px - 2, b, px + 4, b, ink);
        }
        g.line(l + 8, t + 6, r - 8, t + 6, ink); // under-seat rail
        return;
      }
      if (paint === 'red') {
        g.fill(l, t, r - l + 1, b - t + 1, CURB.red);
        g.rect(l, t, r - l + 1, b - t + 1, ink);
        g.line(l + 1, t + 1, r - 1, t + 1, CURB.lit); // lit top face
        g.line(l + 1, t + 2, r - 1, t + 2, CURB.lit);
        g.line(l + 1, b - 1, r - 1, b - 1, CURB.dark); // shaded foot
        g.line(l + 1, b - 2, r - 1, b - 2, CURB.dark);
        for (let px = l + 3; px < r - 2; px += 7) { // chips down to the concrete, in fixed spots
          const h = (px * 37 + 11) % 5;
          g.pset(px + (h % 3), t + 3 + (h % 2), CURB.chip);
          if (h === 0) g.pset(px + 1, t + 4, CURB.chip);
        }
        return;
      }
      // concrete block: black outline, grey body, silver lit top and a glint
      g.fill(l, t, r - l + 1, b - t + 1, steel);
      g.rect(l, t, r - l + 1, b - t + 1, ink);
      g.line(l + 1, t + 1, r - 1, t + 1, shine);
      g.line(l + 1, t + 2, Math.min(r - 1, l + 1 + Math.round((r - l) * 0.5)), t + 2, shine);
      g.pset(l + 2, t + 1, white);
      g.line(l + 1, b - 1, r - 1, b - 1, ink); // shadow at the foot
      if (lid) {
        // a lid that sticks out a pixel each side, and a couple of ridges
        g.line(l - 1, t, r + 1, t, ink);
        g.line(l - 1, t + 1, r + 1, t + 1, shine);
        for (const f of [0.33, 0.66]) g.line(l + 2, t + Math.round((b - t) * f), r - 2, t + Math.round((b - t) * f), ink);
      }
    },
  };
}
