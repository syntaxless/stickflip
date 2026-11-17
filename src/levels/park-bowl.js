import { bank } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Stage 5, section 4: a bowl. Ride down into it and up the far side; the lip throws you.
const G = WORLD.GROUND;

export default {
  id: 'park-bowl',
  name: 'Bowl',
  obstacles: [
    bank({ x: 220, run: 150, y1: G, y2: G + 36 }),
    bank({ x: 370, run: 110, y1: G + 36, y2: G + 36 }),
    bank({ x: 480, run: 150, y1: G + 36, y2: G }),
  ],
};
