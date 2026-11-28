import { terrain, caneRail } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Candy Land, section 5: a kicker up to a fudge ridge, a step down, then the second big pit. Take it with a charged
// ollie, or lock onto the long arched candy cane that reaches across and grind to the far side.
const G = WORLD.GROUND;
export default {
  id: 'candy-ridge',
  name: 'Fudge Ridge',
  obstacles: [
    terrain([['flat', 0, 150, 45], ['ramp', 150, 210, 45, 69], ['flat', 210, 340, 69], ['flat', 340, 560, 59], ['pit', 560, 880], ['flat', 880, 960, 49]]),
    caneRail({ x: 540, length: 340, height: 38, base: G - 59, arc: 26, feet: [[548, 59], [874, 49]] }),
  ],
};
