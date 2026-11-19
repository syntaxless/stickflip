import { bank, snowman } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Frostbite, section 1: three snowdrifts, like whoops on a dirt track, then a snowman standing in the
// road. Roll over the drifts (or pop each crest for air), then ollie the snowman: a plain ollie, or
// a charged one for more hang time.
const G = WORLD.GROUND;
const drift = (x) => [bank({ x, run: 90, y1: G, y2: G - 30 }), bank({ x: x + 90, run: 90, y1: G - 30, y2: G })];

export default {
  id: 'frost-drifts',
  name: 'Snowdrifts',
  obstacles: [...drift(240), ...drift(430), snowman({ x: 800 })],
};
