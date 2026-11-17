import { brokenGap, brokenSlab, sign } from '../obstacles/index.js';

// Stage 3, section 7 (the finale): a broken slab of sidewalk tilted up as a kicker, and a big gap full of rubble where the sidewalk has broken away. Ollie off the lip.

export default {
  id: 'big-gap',
  name: 'Big Gap',
  obstacles: [sign({ x: 180 }), brokenSlab({ x: 280, run: 120, rise: 60 }), brokenGap({ x: 400, width: 240 })],
};
