import { bank, rail } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Junkyard, section 2: a plank kicker and a rusty pipe rail (SCRAP GRIND). Ollie off the kicker and lock
// the grind; every grind kicks the turbo in.
const G = WORLD.GROUND;

export default {
  id: 'junk-rail',
  name: 'Scrap Rail',
  cues: [{ x: 200, lead: -0.11, act: 'tap' }, { x: 201, act: 'lock' }], // the rival's inputs (node scripts/solve-rival.mjs --write)
  obstacles: [bank({ x: 200, run: 100, y1: G, y2: G - 44, material: 'wood' }), rail({ x: 470, length: 260, height: 52 })],
};
