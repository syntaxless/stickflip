import { box } from '../obstacles/index.js';

// Stage 2, section 1: a long, low curb. Ollie over it, or onto it and roll
// along the top (a timed tap grinds it); hit its side and you slam.
export default {
  id: 'curb',
  name: 'Curb',
  obstacles: [box({ x: 440, w: 150, h: 30, landable: true, grindable: true })],
};
