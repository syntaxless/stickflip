import { sandbox, swingSet } from '../obstacles/index.js';

// Stage 4, section 3: a sandbox. Ollie over it.
export default {
  id: 'sandbox',
  name: 'Sandbox',
  obstacles: [swingSet({ x: 130 }), sandbox({ x: 440, width: 150 })],
};
