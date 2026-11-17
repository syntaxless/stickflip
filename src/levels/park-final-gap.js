import { bank, gap } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Stage 5, section 7 (the finale): a tall kicker and the biggest gap in the game.
const G = WORLD.GROUND;

export default {
  id: 'park-final-gap',
  name: 'Final Gap',
  obstacles: [bank({ x: 260, run: 130, y1: G, y2: G - 65 }), gap({ x: 390, width: 250 })],
};
