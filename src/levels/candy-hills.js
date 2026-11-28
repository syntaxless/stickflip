import { terrain, caneSlope, gumdropBlock, belt } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Candy Land, section 7: more rolling hills with the gumball still behind you. A candy cane up the first hill,
// more caramel, a kicker, a gumdrop block on the table, and the long ramp down to the candy machine.
const G = WORLD.GROUND;
export default {
  id: 'candy-hills',
  name: 'Cane Hills',
  obstacles: [
    terrain([['flat', 0, 400, 40], ['ramp', 400, 480, 40, 24], ['flat', 480, 600, 24], ['ramp', 600, 660, 24, 44], ['flat', 660, 780, 44], ['ramp', 780, 930, 44, 0], ['flat', 930, 960, 0]]),
    caneSlope({ x1: 260, y1: G - 40 - 74, x2: 470, y2: G - 40 - 90, passable: true, feet: [[276, G - 40], [450, G - 30]] }),
    belt({ x: 280, w: 140, v: -170, h: 40, goo: true }),
    gumdropBlock({ x: 690, w: 60, h: 26, base: G - 44, color: 1 }),
  ],
};
