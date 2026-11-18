import { bank, rail } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Stage 2, section 7: a wooden kicker and a flat rail past it. Ollie off the
// kicker and lock a grind on the rail (KICKER TO RAIL), roll up and grind it
// from a flat-ground ollie, or fly the whole rail with a charged ollie.
const G = WORLD.GROUND;

export default {
  id: 'kicker-rail',
  name: 'Kicker Rail',
  obstacles: [bank({ x: 300, run: 100, y1: G, y2: G - 40, material: 'wood' }), rail({ x: 520, length: 240, height: 52 })],
};
