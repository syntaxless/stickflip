import { bank, barricade } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Hellride, section 1: three bumps, like whoops on a dirt track, then a low
// basalt block. Roll over the bumps (or pop each crest); ollie the block, or
// ride straight into it with the finger held to slappy-grind it.
const G = WORLD.GROUND;
const hill = (x) => [bank({ x, run: 80, y1: G, y2: G - 26 }), bank({ x: x + 80, run: 80, y1: G - 26, y2: G })];

export default {
  id: 'hell-bumps',
  name: 'Brimstone Bumps',
  cues: [{ x: 800, lead: 0.36, act: 'tap' }], // the rival's inputs (node scripts/solve-rival.mjs --write)
  obstacles: [...hill(240), ...hill(400), ...hill(560), barricade({ x: 800, w: 56, h: 34 })],
};
