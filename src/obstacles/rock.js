import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';
import { box } from './box.js';

// A tiny rock on the street. Roll into it and the board stops dead while you
// fly on (a slam); any ollie lifts your feet over it. Drawn as a little
// shaded dome in the same chunky pixel style as the trash can.
export function rock({ x, w = 36, h = 18, base = WORLD.GROUND }) {
  const solid = box({ x, w, h, base });
  return {
    ...solid,
    type: 'rock',
    draw(g) {
      const P = (v) => Math.round(v / 3);
      const [l, r, b] = [P(x), P(x + w) - 1, P(base) - 1];
      const rows = P(h); // pixels tall
      const { ink, steel, shine, wheel: white } = PAL;
      for (let i = 0; i < rows; i++) {
        // a dome: the top row is narrow, the sides slope out to the full width
        const inset = Math.max(0, Math.round(((rows - 1 - i) * (r - l)) / (rows * 2.6)));
        const y = b - (rows - 1) + i;
        const [a, z] = [l + inset, r - inset];
        g.line(a, y, z, y, steel);
        g.pset(a, y, ink);
        g.pset(z, y, ink);
        if (i === 0) g.line(a, y, z, y, ink);
        if (i > 0 && i < rows - 1) g.line(a + 1, y, a + Math.max(1, Math.round((z - a) * 0.4)), y, shine);
      }
      g.line(l, b, r, b, ink); // flat underside
      g.pset(l + 3, b - rows + 3, white);
    },
  };
}
