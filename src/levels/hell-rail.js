import { bank, rail } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Hellride, section 2: a charred kicker and a long rail past it. Ollie off the
// kicker and lock the grind (KICKER TO RAIL), ollie on from the flat, or fly
// the whole rail with a charged ollie. The grind kicks the turbo in.
const G = WORLD.GROUND;

export default {
  id: 'hell-rail',
  name: 'Cinder Rail',
  cues: [{ x: 200, lead: -0.1, act: 'tap' }, { x: 201, act: 'lock' }], // the rival's inputs (node scripts/solve-rival.mjs --write)
  obstacles: [bank({ x: 200, run: 100, y1: G, y2: G - 44, material: 'wood' }), rail({ x: 470, length: 300, height: 52 })],
};
