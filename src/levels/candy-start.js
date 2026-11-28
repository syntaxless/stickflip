import { terrain, caneRail } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Candy Land, section 1: a flat start on a high sugar shelf, a small drop, a kicker up onto a raised platform and a
// candy cane rail along it (the sketch's first rail). Roll the kicker or ollie it, then grind the cane or just ollie past.
const G = WORLD.GROUND;
export default {
  id: 'candy-start',
  name: 'Sugar Start',
  obstacles: [
    terrain([['flat', 0, 170, 136], ['ramp', 170, 250, 136, 116], ['flat', 250, 470, 116], ['ramp', 470, 540, 116, 152], ['flat', 540, 960, 152]]),
    caneRail({ x: 620, length: 230, height: 50, base: G - 152 }),
  ],
};
