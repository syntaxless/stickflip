import { bank, tireStack, finishArch } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Junkyard, section 9: the finish straight. A last tyre heap and a tall stack (ollie it, or bring the speed
// down to be sure of landing), then the finish arch. First across the line wins.
const G = WORLD.GROUND;

export default {
  id: 'junk-finish',
  name: 'Finish Straight',
  cues: [{ x: 380, lead: 0.34, act: 'tap' }], // the rival's inputs (node scripts/solve-rival.mjs --write)
  obstacles: [
    bank({ x: 140, run: 80, y1: G, y2: G - 26 }),
    bank({ x: 220, run: 80, y1: G - 26, y2: G }),
    tireStack({ x: 380, w: 56, h: 46 }),
    finishArch({ x: 760 }),
  ],
};
