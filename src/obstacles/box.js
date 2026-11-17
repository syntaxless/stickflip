import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';

const SLAPPY_MAX = 36; // the tallest curb you can slap onto without an ollie

// A block standing on the street: a curb, a trash can. Its sides slam you if
// you hit them, so ollie over it. A `landable` top can be landed on and rolled
// across (roll off the end and you drop back down); a `grindable` one can be
// ground with a timed tap, like a rail, and if it's low enough, slappied:
// ridden straight into with the finger held, no ollie. Anything else on top is a bail.
export function box({ x, w, h, landable = false, grindable = false, lid = false, base = WORLD.GROUND }) {
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
      g.fill(l, t, r - l + 1, b - t + 1, PAL.ground);
      g.rect(l, t, r - l + 1, b - t + 1, PAL.edge);
      if (lid) {
        // a lid that sticks out a pixel each side, and a couple of ridges
        g.line(l - 1, t, r + 1, t, PAL.edge);
        g.line(l - 1, t + 1, r + 1, t + 1, PAL.edge);
        for (const f of [0.33, 0.66]) g.line(l + 2, t + Math.round((b - t) * f), r - 2, t + Math.round((b - t) * f), PAL.edge);
      }
    },
  };
}
