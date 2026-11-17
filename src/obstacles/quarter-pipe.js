import { WORLD } from '../config.js';
import { pipe } from '../render/shaded.js';

// A quarter pipe against the right side of the screen: a curve of `radius`
// from the street at x up to vertical, with a deck behind it. The skater
// rides up, goes straight up out of it, turns around and rides back down to
// the left (see Game.updateRamp). Flying into the deck below the coping is a
// bail.
export function quarterPipe({ x, radius }) {
  const top = WORLD.GROUND - radius;
  return {
    type: 'quarterPipe',
    surfaces: [],
    solids: [],
    ground: [
      { x1: x, x2: x + radius, qp: { cx: x, cy: top, R: radius }, landable: true },
      { x1: x + radius, x2: Infinity, y: top, landable: false, bail: 'wall', wall: 'wall' },
    ],
    // The ramp itself is ground; this adds the coping, a little pipe on the lip.
    draw(g) {
      const P = (v) => Math.round(v / 3);
      pipe(g, P(x + radius) - 2, P(top) - 3, P(x + radius) + 2, P(top) - 3);
    },
  };
}
