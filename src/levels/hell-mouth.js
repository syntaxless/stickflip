import { bank, lavaPit, bridgeRail } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Hellride, section 7: the big jump. A charred kicker, then a 320-wide lava pit. At cruising
// speed a plain ollie off the kicker falls short; a turbo kick (from the grinds and the ring
// before it) or a charged ollie carries it, or ollie off and land the arched rail hung over
// the pit for a grind across (the safe line).
const G = WORLD.GROUND;

export default {
  id: 'hell-mouth',
  name: 'Hellmouth Jump',
  cues: [{ x: 310, lead: 0.2, act: 'tap' }, { x: 311, act: 'lock' }], // the rival's inputs (node scripts/solve-rival.mjs --write)
  obstacles: [
    bank({ x: 180, run: 130, y1: G, y2: G - 70, material: 'wood' }),
    lavaPit({ x: 310, width: 320 }),
    bridgeRail({ x: 400, length: 240, height: 100, arc: 40 }),
  ],
};
