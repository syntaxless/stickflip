import { concreteSet } from '../obstacles/index.js';

// Stage 5, section 6: the big set: three big concrete steps (about three times
// the size of the usual ones), no rail. Ollie or flip all the way down. The
// concrete platform starts after the bank that leads up to it.
export default {
  id: 'park-big-set',
  name: 'Big Set',
  obstacles: [concreteSet({ x: 380, steps: 3, run: 100, rise: 48, from: 72 })],
};
