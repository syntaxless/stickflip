import { stairs, trafficBarrel } from '../obstacles/index.js';

// Stage 3, section 6: the big drop. The same 108 high platform as the old six-step
// set, with no stairs and no rail: just roll off the edge down to the street.
// A traffic barrel waits close to the bottom, so there are two ways through: roll
// off, land and ollie the barrel, or take a charged ollie off the edge and clear
// the drop and the barrel in one jump.
export default {
  id: 'big-drop',
  name: 'Big Drop',
  obstacles: [stairs({ x: 550, steps: 1, rise: 108, handrail: false, material: 'concrete' }), trafficBarrel({ x: 790 })],
};
