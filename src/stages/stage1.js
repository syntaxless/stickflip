import { stage } from './compose.js';
import { bank } from '../obstacles/index.js';
import { LEVELS } from '../levels/index.js';
import { WORLD } from '../config.js';

// Stage 1: the six original levels as one ride. Each keeps its own screen
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
  extra: [bank({ x: 2 * W - 210, run: 160, y1: G, y2: STAIR_TOP }), bank({ x: 2 * W - 50, run: 50, y1: STAIR_TOP, y2: STAIR_TOP })],
  finishLeft: 5 * W + 60, // back out of the quarter pipe's screen
  camTop: 100, // only raise the camera when the rider gets this close to the top
});
