import { stairs } from '../obstacles/index.js';

// Level 3: start up on a platform with five stairs down to the street and a
// handrail alongside. Either ollie (or flip) the whole set, or tap just before
// the handrail to grind it down.
export default {
  id: 'handrail-stairs',
  name: 'Five Stair',
  obstacles: [stairs({ x: 400, steps: 5, run: 46, rise: 16 })],
  stars: [0, 600, 1100],
};
