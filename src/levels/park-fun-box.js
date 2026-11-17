import { funBox } from '../obstacles/index.js';

// Stage 5, section 5: a fun box: a wooden trapezoid (480 long: about as long as a full-charge ollie can clear) with
// a rail along its flat top. Ride up it, or ollie on and grind the rail.
export default {
  id: 'park-fun-box',
  name: 'Fun Box',
  obstacles: [funBox({ x: 330 })],
};
