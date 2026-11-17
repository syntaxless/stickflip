import { funBox } from '../obstacles/index.js';

// Stage 5, section 5: a fun box: a wooden trapezoid sitting on the street with
// a rail along its flat top. Ride up it, or ollie on and grind the rail.
export default {
  id: 'park-fun-box',
  name: 'Fun Box',
  obstacles: [funBox({ x: 220 })],
};
