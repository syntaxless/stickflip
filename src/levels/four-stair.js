import { stairs } from '../obstacles/index.js';

// Stage 2, section 6: four stairs down with a handrail. The stage lays a bank up
// to the top (stages/stage2.js). Ollie down the set (STAIR SET), or ollie
// onto the handrail and grind it down (HANDRAIL).
export default {
  id: 'four-stair',
  name: 'Four Stair',
  obstacles: [stairs({ x: 360, steps: 4, run: 50, rise: 16, material: 'concrete' })],
};
