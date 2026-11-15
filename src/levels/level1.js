import { rail } from '../obstacles/index.js';

// Level 1: one low, long rail. It's too long to ollie over, so the only way
// past is to pop, tap again over the rail to lock a 50-50 grind, and ride it out.
export default {
  id: 'first-rail',
  name: 'First Rail',
  hint: 'TAP: OLLIE.  TAP JUST BEFORE THE RAIL: GRIND.',
  obstacles: [rail({ x: 430, length: 260, height: 64 })],
  // Score needed for 1, 2 and 3 stars. Star 1 just means "made it".
  stars: [0, 700, 1400],
};
