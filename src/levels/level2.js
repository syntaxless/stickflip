import { rail } from '../obstacles/index.js';

// Level 2: one low, long rail, set close to the start (100 units closer than before: less dead
// space after the First Gap, still 0.76 s of run-up after the READY beat). It's too long to ollie over, so the only way
// past is to pop, tap again over the rail to lock a 50-50 grind, and ride it out.
export default {
  id: 'first-rail',
  name: 'First Rail',
  obstacles: [rail({ x: 330, length: 260, height: 64 })],
};
