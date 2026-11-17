import { box } from '../obstacles/index.js';

// Stage 2, section 1: a long, low red-painted curb (300 wide). Ollie over it, or onto it and roll
// along the top (a timed tap grinds it), or slappy it: ride into it with the
// finger held and grind with no ollie. Hit its side any other way and you slam.
export default {
  id: 'curb',
  name: 'Curb',
  obstacles: [box({ x: 400, w: 300, h: 30, landable: true, grindable: true, paint: 'red' })],
};
