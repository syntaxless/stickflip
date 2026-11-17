import { bank, brokenGap, sign } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Stage 3, section 7 (the finale): a tall kicker and a big gap where the sidewalk has broken away over dirt. Ollie off the lip.
const G = WORLD.GROUND;

export default {
  id: 'big-gap',
  name: 'Big Gap',
  obstacles: [sign({ x: 180 }), bank({ x: 280, run: 120, y1: G, y2: G - 60 }), brokenGap({ x: 400, width: 240 })],
};
