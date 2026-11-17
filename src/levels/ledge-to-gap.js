import { barrier, gap, sign } from '../obstacles/index.js';

// Stage 3, section 3: ollie up onto a jersey barrier (or grind along it), then
// ollie off its end over the gap right behind it.
export default {
  id: 'ledge-to-gap',
  name: 'Barrier Gap',
  obstacles: [sign({ x: 200 }), barrier({ x: 300, w: 220, h: 36 }), gap({ x: 520, width: 160 })],
};
