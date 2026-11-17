import { rail } from '../obstacles/index.js';

// Stage 3, section 3: a long rail. Ollie on, lock the grind with a timed tap and ride it out.
export default {
  id: 'long-rail',
  name: 'Long Rail',
  obstacles: [rail({ x: 300, length: 430, height: 50 })],
};
