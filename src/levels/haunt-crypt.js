import { bank, fenceRail } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Haunted Night, section 2: a coffin-lid kicker and a wrought-iron fence laid down as a rail. Ollie off the
// kicker and lock the grind (FENCE GRIND), ollie up to the fence from the flat, or fly it with a charged ollie.
const G = WORLD.GROUND;

export default {
  id: 'haunt-crypt',
  name: 'Crypt Fence',
  obstacles: [bank({ x: 220, run: 110, y1: G, y2: G - 48, material: 'wood' }), fenceRail({ x: 500, length: 240, height: 50 })],
};
