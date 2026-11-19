import { bank, boardRail } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Boardwalk, section 2: a wooden kicker and a planked rail with a lifebuoy on it. Ollie off the kicker and
// lock a grind (BOARD GRIND), ollie up to the rail from the flat, or fly the whole rail with a charged ollie.
const G = WORLD.GROUND;

export default {
  id: 'beach-pier',
  name: 'Pier Rail',
  obstacles: [bank({ x: 220, run: 110, y1: G, y2: G - 48, material: 'wood' }), boardRail({ x: 500, length: 240, height: 50 })],
};
