import { bank, ballPit, swingSet } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Stage 4, section 7 (the finale): a tall kicker and a ball pit. Ollie off the
// lip and clear it.
const G = WORLD.GROUND;

export default {
  id: 'ball-pit',
  name: 'Ball Pit',
  obstacles: [swingSet({ x: 120 }), bank({ x: 280, run: 120, y1: G, y2: G - 60 }), ballPit({ x: 400, width: 240 })],
};
