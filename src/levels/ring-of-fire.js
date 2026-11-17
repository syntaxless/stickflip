import { bank, gap, ring } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Stage 2, section 4: a kicker, a gap, and a ring of fire hanging over the
// gap. Ollie off the kicker through the ring: too high and your head's in
// the flames, too low and your feet are. Through it is a trick of its own.
const G = WORLD.GROUND;

export default {
  id: 'ring-of-fire',
  name: 'Ring of Fire',
  obstacles: [
    bank({ x: 320, run: 100, y1: G, y2: G - 50 }),
    gap({ x: 420, width: 180 }),
    ring({ x: 510, top: 135, bottom: 240 }),
  ],
};
