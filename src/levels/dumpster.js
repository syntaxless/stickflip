import { bank, dumpster, groundBag } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Stage 2, section 7 (the finale): a kicker and a dumpster. Ollie off the kicker over the
// whole thing (BIG LEAP) or lock a grind on
// the rim with a timed tap. Landing on it any other way bails.
const G = WORLD.GROUND;

export default {
  id: 'dumpster',
  name: 'Dumpster',
  obstacles: [
    bank({ x: 220, run: 100, y1: G, y2: G - 50, material: 'wood' }),
    groundBag({ x: 440 }), // scenery between the ramp and the dumpster
    dumpster({ x: 470 }),
  ],
};
