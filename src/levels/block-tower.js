import { blockTower } from '../obstacles/index.js';

// Stage 4, section 6: a tower of toy blocks. Ollie up the three steps onto the
// top, then roll off the far end.
export default {
  id: 'block-tower',
  name: 'Block Tower',
  obstacles: [blockTower({ x: 420, steps: 3, run: 45, rise: 28 })],
};
