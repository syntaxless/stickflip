import { stage } from './compose.js';
import dunes from '../levels/beach-dunes.js';
import pier from '../levels/beach-pier.js';
import sea from '../levels/beach-sea.js';
import cart from '../levels/beach-cart.js';
import flags from '../levels/beach-flags.js';
import tower from '../levels/beach-tower.js';
import pierEnd from '../levels/beach-pier-end.js';

// Stage 8: BOARDWALK, a sunny seaside promenade. Planks to ride on, sand heaped over them, the sea
// glittering behind, palms and gulls. Dunes and a sandcastle, a lifebuoy rail, a gap over the sea, an ice
// cream cart, bunting, a lifeguard tower and the end of the pier. Every obstacle has a safe line and a
// riskier one. Opens when Stage 7 is finished, like every other stage.
export default stage({
  id: 'stage-8',
  name: 'Boardwalk',
  sections: [dunes, pier, sea, cart, flags, tower, pierEnd],
  starts: { 2: 10 }, // 8-3 spawns further back: more run-up to the sea gap
  camTop: 100,
  palette: 'beach',
  beach: true, // the sky and the ground
});
