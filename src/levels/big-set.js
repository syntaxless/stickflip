import { stairs } from '../obstacles/index.js';

// Stage 3, section 4: a big six-step set with a handrail. Ollie all the way
// down, or lock a grind on the rail.
export default {
  id: 'big-set',
  name: 'Big Set',
  obstacles: [stairs({ x: 400, steps: 6, run: 46, rise: 18 })],
};
