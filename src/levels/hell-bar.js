import { rail } from '../obstacles/index.js';

// Hellride, section 5: a flat bar. Ollie on and lock a grind with a timed tap (the turbo kicks
// in), or hold for a charged ollie and fly the whole bar.
export default {
  id: 'hell-bar',
  name: 'Bone Bar',
  cues: [{ x: 340, lead: 0.41, act: 'tap' }, { x: 341, act: 'lock' }], // the rival's inputs (node scripts/solve-rival.mjs --write)
  obstacles: [rail({ x: 340, length: 200, height: 52 })],
};
