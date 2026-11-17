import { bank, stepsUp } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Level 5: euro gap. A bank runs right up to the foot of a two-stair going up.
// Ride up the bank and ollie off its lip up the stairs onto the top: land on
// the lower step, or hit a riser, and you bail. The whole thing is poured concrete.
const G = WORLD.GROUND;
const LIP = G - 55;

export default {
  id: 'euro-gap',
  name: 'Euro Gap',
  obstacles: [
    bank({ x: 250, run: 160, y1: G, y2: LIP, material: 'concrete' }),
    bank({ x: 410, run: 60, y1: LIP, y2: LIP, material: 'concrete' }), // the short flat lip
    stepsUp({ x: 470, steps: 2, run: 125, rise: 37, base: LIP, material: 'concrete' }),
  ],
};
