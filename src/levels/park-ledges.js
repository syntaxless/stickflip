import { box } from '../obstacles/index.js';

// Stage 5, section 1: two concrete ledges with a street gap between. Ollie
// on, grind (a timed tap) or roll, drop off the end and ollie the next.
export default {
  id: 'park-ledges',
  name: 'Ledges',
  obstacles: [box({ x: 340, w: 150, h: 36, landable: true, grindable: true }), box({ x: 640, w: 170, h: 36, landable: true, grindable: true })],
};
