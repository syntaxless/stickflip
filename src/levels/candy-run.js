import { terrain, caneSlope, belt } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Candy Land, section 6: the giant gumball starts rolling after you (see `chase` in stage11.js). Sticky caramel
// slows you down: grind the cane over it, ollie it, or push through and lose some of your lead. Kicker up, table,
// roll down.
const G = WORLD.GROUND;
export default {
  id: 'candy-run',
  name: 'Gumball Run',
  obstacles: [
    terrain([['flat', 0, 540, 49], ['ramp', 540, 620, 49, 38], ['flat', 620, 680, 38], ['ramp', 680, 730, 38, 58], ['flat', 730, 790, 58], ['ramp', 790, 860, 58, 40], ['flat', 860, 960, 40]]),
    belt({ x: 340, w: 170, v: -170, h: 49, goo: true }),
    // a cane hung over the caramel on two sticks: roll under it (and get stuck), or ollie up and grind it for the turbo
    caneSlope({ x1: 300, y1: G - 49 - 84, x2: 520, y2: G - 49 - 84, passable: true, feet: [[316, G - 49], [504, G - 49]] }),
  ],
};
