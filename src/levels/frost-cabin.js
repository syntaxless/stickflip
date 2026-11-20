import { cabin } from '../obstacles/index.js';

// Frostbite, section 6: a log cabin. Ollie up onto its snowy roof and roll along it, lock a grind on
// the roof edge (CABIN GRIND), or fly the whole cabin with a charged ollie. Roll off the end, or ollie
// off it for ROOF DROP.
export default {
  id: 'frost-cabin',
  name: 'Cabin Roof',
  obstacles: [cabin({ x: 360, w: 220, h: 60 })],
};
