import { bank, gap, ring } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Stage 2, section 4: a kicker, a gap, and a ring of fire hanging over the
// gap. Ollie off the kicker through the ring. Any ollie off the kicker that
// clears the gap fits, tapped or charged; only the very biggest (a full
// charge popped low on the kicker) puts your head in the flames, and rolling
// off without an ollie puts your feet in them. Through it is a trick.
const G = WORLD.GROUND;

export default {
  id: 'ring-of-fire',
  name: 'Ring of Fire',
  obstacles: [
    bank({ x: 320, run: 100, y1: G, y2: G - 50 }),
    gap({ x: 420, width: 180 }),
    ring({ x: 470, top: 108, bottom: 262 }),
  ],
};
