import { stairs } from '../obstacles/index.js';

// Stage 5, section 6: the big set: six steps with a handrail. Ollie all the
// way down, or lock a grind on the rail.
export default {
  id: 'park-big-set',
  name: 'Big Set',
  obstacles: [stairs({ x: 420, steps: 6, run: 44, rise: 18 })],
};
