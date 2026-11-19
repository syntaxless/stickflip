import { iceBlock } from '../obstacles/index.js';

// Frostbite, section 4: two blocks of ice. Ollie each one, grind the top edge of either (a timed tap),
// or slappy the low second block with the finger held.
export default {
  id: 'frost-hurdles',
  name: 'Ice Hurdles',
  obstacles: [iceBlock({ x: 330, w: 56, h: 46 }), iceBlock({ x: 700, w: 64, h: 32 })],
};
