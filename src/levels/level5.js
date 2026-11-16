import { bank, gap, stepsUp } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Level 5: euro gap. A bank leads up to a gap with a two-stair rising on the
// far side. Ollie off the bank and up over the gap onto the top: land on the
// lower step, or come up short, and you bail.
const G = WORLD.GROUND;

export default {
  id: 'euro-gap',
  name: 'Euro Gap',
  hint: 'OLLIE OFF THE BANK, UP ONTO THE TOP STEP.',
  obstacles: [bank({ x: 300, run: 100, y1: G, y2: G - 36 }), gap({ x: 400, width: 150 }), stepsUp({ x: 550, steps: 2, run: 40, rise: 25 })],
  stars: [0, 150, 300],
};
