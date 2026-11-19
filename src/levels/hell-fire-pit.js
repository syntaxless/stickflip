import { lavaPit, fireRing } from '../obstacles/index.js';

// Hellride, section 5: a fire pit with a ring of fire hanging over its middle.
// A plain ollie just clears the pit (200 wide) and goes through the ring: a bonus
// and a turbo kick. Too low and you drop in the lava, too late and you do too.
export default {
  id: 'hell-fire-pit',
  name: 'Fire Pit',
  cues: [{ x: 330, lead: 0.16, act: 'tap' }], // the rival's inputs (node scripts/solve-rival.mjs --write)
  obstacles: [lavaPit({ x: 330, width: 200 }), fireRing({ x: 430, top: 290, bottom: 110 })],
};
