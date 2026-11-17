import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';
import { box } from './box.js';

// A rock on the street. Roll into it and the board stops dead while you fly on
// (a slam); any ollie lifts your feet over it. A lumpy boulder in chunky
// shaded pixel art: an uneven outline, a light top-left, a dark underside, a
// couple of cracks and some speckle. Used at 1-1 and 3-1.
const { ink } = PAL;
const LIGHT = [205, 205, 212];
const MID = [150, 150, 160];
const DARK = [96, 96, 108];
const CRACK = [70, 70, 82];

// Left and right inset (in pixels) of each row, top to bottom, on a 16 wide rock.
const LEFT = [6, 4, 2, 1, 0, 0, 0, 0, 0];
const RIGHT = [5, 3, 2, 2, 1, 0, 1, 0, 0];

export function rock({ x, w = 48, h = 27, base = WORLD.GROUND }) {
  const solid = box({ x, w, h, base });
  return {
    ...solid,
    type: 'rock',
    draw(g) {
      const P = (v) => Math.round(v / 3);
      const l = P(x);
      const wd = P(w);
      const rows = LEFT.length;
      const b = P(base) - 1;
      const top = b - rows + 1;
      for (let i = 0; i < rows; i++) {
        const y = top + i;
        const a = l + Math.round((LEFT[i] * wd) / 16);
        const z = l + wd - 1 - Math.round((RIGHT[i] * wd) / 16);
        for (let px = a; px <= z; px++) {
          const u = (px - a) / Math.max(1, z - a); // 0 left .. 1 right
          const v = i / (rows - 1); // 0 top .. 1 bottom
          const k = u * 0.55 + v * 0.75; // lit from the top left
          g.pset(px, y, k < 0.38 ? LIGHT : k < 0.95 ? MID : DARK);
        }
        g.pset(a, y, ink);
        g.pset(z, y, ink);
      }
      g.line(l + Math.round((LEFT[0] * wd) / 16), top, l + wd - 1 - Math.round((RIGHT[0] * wd) / 16), top, ink); // top edge
      g.line(l, b, l + wd - 1, b, ink); // flat underside on the street
      // cracks and speckle
      g.line(l + 7, top + 2, l + 8, top + 4, CRACK);
      g.pset(l + 9, top + 5, CRACK);
      g.line(l + 4, top + 5, l + 5, top + 6, CRACK);
      g.pset(l + 3, top + 3, PAL.wheel);
      g.pset(l + 5, top + 2, PAL.wheel);
      g.pset(l + 11, top + 6, DARK);
    },
  };
}
