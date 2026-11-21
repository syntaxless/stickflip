import { stage } from './compose.js';
import stones from '../levels/haunt-stones.js';
import crypt from '../levels/haunt-crypt.js';
import grave from '../levels/haunt-grave.js';
import patch from '../levels/haunt-patch.js';
import gates from '../levels/haunt-gates.js';
import tomb from '../levels/haunt-tomb.js';
import gate from '../levels/haunt-gate.js';

// Stage 10: HAUNTED NIGHT, a graveyard under a huge moon. Twilight purple sky, mist along the ground, bats,
// a haunted mansion on the hill. Tombstones, a crypt fence, an open grave with a coffin lid in it, a pumpkin
// patch, lantern gates, a mausoleum and the mansion gate. Every obstacle has a safe line and a riskier one.
// Opens when Stage 9 is finished, like every other stage.
export default stage({
  id: 'stage-10',
  name: 'Graveyard',
  sections: [stones, crypt, grave, patch, gates, tomb, gate],
  starts: { 2: 10 }, // 10-3 spawns further back: more run-up to the open grave
  camTop: 100,
  palette: 'haunt',
  haunt: true, // the sky and the ground
});
