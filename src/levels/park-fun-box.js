import { bank, rail } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Stage 5, section 5: a fun box: a bank up, a flat top with a rail along it,
// and a bank down. Ride it, or ollie on and grind the rail.
const G = WORLD.GROUND;
const TOP = G - 50;

export default {
  id: 'park-fun-box',
  name: 'Fun Box',
  obstacles: [
    rail({ x: 450, length: 180, height: 34, base: TOP }),
    bank({ x: 270, run: 110, y1: G, y2: TOP }),
    bank({ x: 380, run: 280, y1: TOP, y2: TOP }),
    bank({ x: 660, run: 110, y1: TOP, y2: G }),
  ],
};
