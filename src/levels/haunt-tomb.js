import { mausoleum } from '../obstacles/index.js';

// Haunted Night, section 6: a mausoleum. Ollie up onto its roof and ride it, lock a grind on the roof edge
// (TOMB GRIND), or fly the whole tomb with a charged ollie (TOMB LEAP). Roll off the end, or ollie off it
// for ROOF DROP.
export default {
  id: 'haunt-tomb',
  name: 'Mausoleum',
  obstacles: [mausoleum({ x: 360 })],
};
