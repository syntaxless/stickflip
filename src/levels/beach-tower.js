import { lifeguardTower } from '../obstacles/index.js';

// Boardwalk, section 6: a lifeguard tower. Ollie up onto its striped roof and roll along it, lock a grind
// on the roof edge (TOWER GRIND), or fly the whole tower with a charged ollie (TOWER LEAP). Roll off the
// end, or ollie off it for TOWER DROP.
export default {
  id: 'beach-tower',
  name: 'Lifeguard Tower',
  obstacles: [lifeguardTower({ x: 360 })],
};
