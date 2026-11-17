import { stairs } from '../obstacles/index.js';

// Stage 5, section 3: a hubba: a low ledge down a stair set. Grind it with a
// timed tap, or ollie the set.
export default {
  id: 'park-hubba',
  name: 'Hubba',
  obstacles: [stairs({ x: 400, steps: 5, run: 46, rise: 16, railHeight: 32 })],
};
