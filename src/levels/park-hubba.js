import { hubba } from '../obstacles/index.js';

// Stage 5, section 3: a hubba: a solid concrete ledge down a stair set. Grind
// its top edge with a timed tap, or ollie the set.
export default {
  id: 'park-hubba',
  name: 'Hubba',
  obstacles: [hubba({ x: 400, steps: 5, run: 46, rise: 16, wallHeight: 32 })],
};
