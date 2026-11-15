import { rail } from '../obstacles/index.js';

// Level 1: one low, long rail. It's too long to ollie over, so the only way
// past is to pop, tap again over the rail to lock a 50-50 grind, and ride it out.
export default {
  id: 'first-rail',
  name: 'First Rail',
  hint: 'Tap to ollie. Tap again when the rail glows to grind it.',
  obstacles: [rail({ x: 430, length: 260, height: 64 })],
  // Score needed for 1, 2 and 3 stars. Star 1 just means "made it".
  stars: [0, 700, 1400],
  // Chalk mark on the ground showing where an ollie reaches the rail.
  takeoffHint: { x1: 262, x2: 384 },
};
