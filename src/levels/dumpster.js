import { bank, dumpster, groundBag } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Stage 2, section 4: a kicker and a dumpster. Ollie off the kicker over the
// whole thing (BIG LEAP), land on the lid and roll off, or lock a grind on
// the lid's edge with a timed tap.
const G = WORLD.GROUND;

export default {
  id: 'dumpster',
  name: 'Dumpster',
  obstacles: [
    bank({ x: 280, run: 100, y1: G, y2: G - 50, material: 'wood' }),
    groundBag({ x: 425 }), // scenery between the ramp and the dumpster
    dumpster({ x: 470 }),
  ],
};
