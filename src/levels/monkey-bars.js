import { monkeyBars } from '../obstacles/index.js';

// Stage 4, section 5: monkey bars. A higher grind: ollie on, tap to lock it.
export default {
  id: 'monkey-bars',
  name: 'Monkey Bars',
  obstacles: [monkeyBars({ x: 340, length: 400, height: 70 })],
};
