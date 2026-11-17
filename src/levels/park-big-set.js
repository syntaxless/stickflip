import { stairs } from '../obstacles/index.js';

// Stage 5, section 6: the big set: three big steps (about three times the
// size of the usual ones) with a handrail. Ollie all the way down, or lock a
// grind on the rail.
export default {
  id: 'park-big-set',
  name: 'Big Set',
  obstacles: [stairs({ x: 380, steps: 3, run: 100, rise: 48, railHeight: 50 })],
};
