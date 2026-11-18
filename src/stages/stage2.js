import { stage } from './compose.js';
import curb from '../levels/curb.js';
import stepUp from '../levels/step-up.js';
import trashCan from '../levels/trash-can.js';
import dumpster from '../levels/dumpster.js';

// Stage 2: street obstacles. Step Up's ledge ends in a drop back to the street.
export default stage({
  id: 'stage-2',
  name: 'Stage 2',
  sections: [curb, stepUp, trashCan, dumpster],
  camTop: 100,
  clouds: true,
});
