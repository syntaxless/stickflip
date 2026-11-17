import { curbCut } from '../obstacles/index.js';

// Stage 5, section 4: a curb cut: a driveway entrance where the curbs dip
// down to the street. The driveway is a dip cut into the ground: ride down and back up.
export default {
  id: 'park-curb-cut',
  name: 'Curb Cut',
  obstacles: [curbCut({ x: 140 })],
};
