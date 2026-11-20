import { bank, sludgePit, steelBeam } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Junkyard, section 8: the magnet jump. A plank kicker, a 320-wide sludge pit and a steel beam arched over
// it. Ollie off the kicker and lock the beam (MAGNET GRIND), or charge one long jump over the lot (MAGNET JUMP).
const G = WORLD.GROUND;

export default {
  id: 'junk-magnet',
  name: 'Magnet Jump',
  cues: [{ x: 310, lead: 0.19, act: 'tap' }, { x: 311, act: 'lock' }], // the rival's inputs (node scripts/solve-rival.mjs --write)
  obstacles: [
    bank({ x: 180, run: 130, y1: G, y2: G - 70, material: 'wood' }),
    sludgePit({ x: 310, width: 320 }),
    steelBeam({ x: 400, length: 240, height: 100, arc: 40 }),
  ],
};
