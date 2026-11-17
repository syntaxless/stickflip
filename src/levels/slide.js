import { bank, slideChute } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Stage 4, section 2: a slide. Ride up the ladder ramp, over the top and down
// the chute. No ollie needed, but the lip throws you, so land it.
const G = WORLD.GROUND;

export default {
  id: 'slide',
  name: 'Slide',
  obstacles: [
    bank({ x: 260, run: 120, y1: G, y2: G - 70 }),
    bank({ x: 380, run: 60, y1: G - 70, y2: G - 70 }),
    bank({ x: 440, run: 260, y1: G - 70, y2: G }),
    slideChute({ x1: 440, y1: G - 70, x2: 700, y2: G }),
  ],
};
