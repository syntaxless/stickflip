import { cone, sign } from '../obstacles/index.js';

// Stage 3, section 2: three traffic cones in a row. One ollie clears them all.
export default {
  id: 'cone-row',
  name: 'Cone Row',
  obstacles: [sign({ x: 820 }), cone({ x: 420 }), cone({ x: 465 }), cone({ x: 510 })],
};
