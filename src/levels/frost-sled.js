import { bank, snowRail } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Frostbite, section 2: a wooden sled kicker and a snowy rail past it. Ollie off the kicker and lock
// a grind (SLED GRIND), ollie up to the rail from the flat, or fly the whole rail with a charged ollie.
const G = WORLD.GROUND;

export default {
  id: 'frost-sled',
  name: 'Sled Run',
  obstacles: [bank({ x: 220, run: 110, y1: G, y2: G - 48, material: 'wood' }), snowRail({ x: 500, length: 240, height: 50 })],
};
