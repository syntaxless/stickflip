import { bank, gap, ring } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Stage 2, section 4: a kicker, a gap, and a ring of fire hanging high over
// the gap. A small ollie off the kicker sails under the ring and just clears
// the gap, no bonus; a charged ollie puts the rider's head through it for the
// RING OF FIRE bonus. Rolling off without an ollie drops into the gap.
const G = WORLD.GROUND;

export default {
  id: 'ring-of-fire',
  name: 'Ring of Fire',
  obstacles: [
    bank({ x: 320, run: 100, y1: G, y2: G - 50 }),
    gap({ x: 420, width: 180 }),
    ring({ x: 470, top: 40, bottom: 140 }),
  ],
};
