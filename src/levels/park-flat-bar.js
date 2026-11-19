import { rail } from '../obstacles/index.js';

// Stage 5, section 2: a flat bar. Ollie on, lock the grind with a timed tap.
// 210 long, not 300: a manual rolls into it at up to 1.8x speed, and the shorter bar
// leaves about 0.4 s to pop out of the manual (a longer bar gave over half a second).
export default {
  id: 'park-flat-bar',
  name: 'Flat Bar',
  obstacles: [rail({ x: 320, length: 210, height: 56 })],
};
