import { sandbox, swingSet } from '../obstacles/index.js';

// Stage 4, section 3: a wide sandbox. A normal ollie lands short in the sand;
// it takes a charged ollie (hold, then let go) to clear it.
export default {
  id: 'sandbox',
  name: 'Sandbox',
  obstacles: [swingSet({ x: 130 }), sandbox({ x: 440, width: 270 })],
};
