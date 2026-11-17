import { rail } from '../obstacles/index.js';

// Stage 5, section 2: a flat bar. Ollie on, lock the grind with a timed tap.
export default {
  id: 'park-flat-bar',
  name: 'Flat Bar',
  obstacles: [rail({ x: 320, length: 300, height: 56 })],
};
