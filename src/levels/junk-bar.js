import { rail } from '../obstacles/index.js';

// Junkyard, section 5: a short length of pipe lying across two oil drums. Ollie and lock the grind, or
// charge over the whole thing.
export default {
  id: 'junk-bar',
  name: 'Pipe Bar',
  cues: [{ x: 340, lead: 0.41, act: 'tap' }, { x: 341, act: 'lock' }], // the rival's inputs (node scripts/solve-rival.mjs --write)
  obstacles: [rail({ x: 340, length: 190, height: 54 })],
};
