import { blockTower } from '../obstacles/index.js';

// Stage 4, section 6: a stack of toy blocks, A on B on C. Ollie up onto the
// top, then roll off the far end.
export default {
  id: 'block-tower',
  name: 'Block Tower',
  obstacles: [blockTower({ x: 420, w: 96, h: 100 })],
};
