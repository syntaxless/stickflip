import { stage } from './compose.js';
import { bank } from '../obstacles/index.js';
import { LEVELS } from '../levels/index.js';
import { WORLD } from '../config.js';

// Stage 1: a rock, then the six original levels as one ride. Each keeps its own screen
// (and name, now a checkpoint). Two joins: a bank up to Five Stair's raised
// start, and a drop off the top of the Euro Gap stairs down to the street
// before the Quarter Pipe (the finale: ride back out to the left to finish).
const W = WORLD.W;
const G = WORLD.GROUND;
const STAIR_TOP = G - 5 * 16; // Five Stair's platform

export default stage({
  id: 'stage-1',
  name: 'Stage 1',
  sections: LEVELS,
  // the ramp starts well after the rail so you can land and roll before going up
  extra: [bank({ x: 3 * W - 90, run: 160, y1: G, y2: STAIR_TOP }), bank({ x: 3 * W + 70, run: 50, y1: STAIR_TOP, y2: STAIR_TOP })],
  // Quarter Pipe's rail is close to the Euro Gap's lip (so the ollie from the top
  // lands on it), so a replay starts back on top of the Euro Gap and rolls off the
  // lip: about a second to the rail instead of under half a second.
  starts: { 6: -120 },
  finishLeft: 6 * W + 60, // back out of the quarter pipe's screen
  camTop: 100, // only raise the camera when the rider gets this close to the top
});
