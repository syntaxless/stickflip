import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';
import { gap } from './gap.js';

// A pool in the street: a gap filled with water. Ollie over it; come up short
// and you drop in with a splash (a gap bail). Drawn over the ground it cuts
// out, with a bright shimmering top row.
const P = (v) => Math.round(v / 3);
const DEEP = [20, 70, 150];
const MID = [40, 110, 200];
const LIGHT = [130, 195, 255];

export function water({ x, width }) {
  const hole = gap({ x, width });
  return {
    ...hole,
    type: 'water',
    water: { x1: x, x2: x + width, y: WORLD.GROUND },
    draw(g, fx = {}) {
      const [l, r] = [P(x), P(x + width) - 1];
      const top = P(WORLD.GROUND) - 1;
      const t = Math.floor((fx.time || 0) * 3);
      g.fill(l, top, r - l + 1, 90, DEEP);
      g.fill(l, top, r - l + 1, 9, MID);
      for (let px = l; px <= r; px++) {
        const wave = (px + t) % 6 < 3 ? 0 : 1; // a little ripple along the surface
        g.pset(px, top + wave, LIGHT);
        if ((px * 5 + t) % 11 === 0) g.pset(px, top + 3 + (px % 4), LIGHT);
      }
      g.line(l, top + 9, r, top + 9, DEEP);
      g.line(l - 1, top, l - 1, top + 90, PAL.ink); // dark edges either side
      g.line(r + 1, top, r + 1, top + 90, PAL.ink);
    },
  };
}
