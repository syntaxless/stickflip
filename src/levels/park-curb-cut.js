import { curbCut } from '../obstacles/index.js';

// Stage 5, section 4: a curb cut: a driveway entrance where the curbs dip
// down to the street. Ride the flares, or ollie onto a curb and grind it.
export default {
  id: 'park-curb-cut',
  name: 'Curb Cut',
  obstacles: [curbCut({ x: 140 })],
};
