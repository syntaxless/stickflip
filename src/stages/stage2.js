import { stage } from './compose.js';
import curb from '../levels/curb.js';
import stepUp from '../levels/step-up.js';
import trashCan from '../levels/trash-can.js';
import dumpster from '../levels/dumpster.js';
import bench from '../levels/bench.js';
import fourStair from '../levels/four-stair.js';
import kickerRail from '../levels/kicker-rail.js';
import { bank } from '../obstacles/index.js';
import { WORLD } from '../config.js';

const W = WORLD.W;
const G = WORLD.GROUND;
const TOP = G - 4 * 16; // Four Stair's platform

// Stage 2: street obstacles. Step Up's ledge ends in a drop back to the street.
export default stage({
  id: 'stage-2',
  name: 'Stage 2',
  sections: [curb, stepUp, trashCan, kickerRail, bench, fourStair, dumpster],
  // Four Stair's platform is up a bank: flat street, the ramp, then the top (the ground that comes first wins)
  extra: [bank({ x: 5 * W, run: 140 }), bank({ x: 5 * W + 140, run: 140, y1: G, y2: TOP, material: 'concrete' }), bank({ x: 5 * W + 280, run: 160, y1: TOP, y2: TOP, material: 'concrete' })],
  camTop: 100,
  clouds: true,
});
