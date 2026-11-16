import { WORLD } from '../config.js';

// A gap in the ground. Ollie over it: come up short (or roll in) and you fall.
// The hole is cut out of the ground by `ground`, so there's nothing to draw.
export function gap({ x, width }) {
  return {
    type: 'gap',
    surfaces: [],
    solids: [],
    ground: [{ x1: x, x2: x + width, y: WORLD.GROUND + 10000, landable: false, bail: 'gap' }],
    draw() {},
  };
}
