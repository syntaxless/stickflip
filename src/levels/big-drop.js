import { stairs, trafficBarrel } from '../obstacles/index.js';

// Stage 3, section 6: the big drop. The same 108 high platform as the old six-step
// set, with no stairs and no rail: just roll off the edge down to the street.
// A traffic barrel waits at the bottom: land and ollie over it.
export default {
  id: 'big-drop',
  name: 'Big Drop',
  obstacles: [stairs({ x: 400, steps: 1, rise: 108, handrail: false }), trafficBarrel({ x: 770 })],
};
