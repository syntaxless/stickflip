import { terrain, caneRail, caneSlope } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Candy Land, section 3: a long candy cane on the flat, then stairs down (two big steps) with a candy cane
// handrail along them. Grind the long cane (or ollie it), then drop the steps, or tap into the handrail and grind
// the whole way down.
const G = WORLD.GROUND;
export default {
  id: 'candy-stairs',
  name: 'Long Rail',
  obstacles: [
    terrain([['flat', 0, 640, 112], ['flat', 640, 790, 64], ['flat', 790, 960, 18]]),
    caneRail({ x: 350, length: 240, height: 50, base: G - 112 }),
    caneSlope({ x1: 600, y1: G - 112 - 34, x2: 900, y2: G - 18 - 34, passable: true, feet: [[620, G - 112], [740, G - 64], [880, G - 18]] }),
  ],
};
