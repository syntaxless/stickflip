import { toyBlocks, swingSet } from '../obstacles/index.js';

// Stage 4, section 1: a pyramid of toy blocks. One ollie clears the lot.
export default {
  id: 'toy-blocks',
  name: 'Toy Blocks',
  obstacles: [swingSet({ x: 120 }), toyBlocks({ blocks: [{ x: 460, w: 45, h: 36 }, { x: 505, w: 45, h: 54 }, { x: 550, w: 45, h: 36 }] })],
};
