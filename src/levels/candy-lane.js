import { terrain, caneRail } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Candy Land, section 4: the low lane. A long candy cane, then a ramp up to the next level.
const G = WORLD.GROUND;
export default {
  id: 'candy-lane',
  name: 'Licorice Lane',
  obstacles: [
    terrain([['flat', 0, 790, 18], ['ramp', 790, 850, 18, 45], ['flat', 850, 960, 45]]),
    caneRail({ x: 360, length: 250, height: 50, base: G - 18 }),
  ],
};
