import { stage } from './compose.js';
import { bank } from '../obstacles/index.js';
import ledges from '../levels/park-ledges.js';
import flatBar from '../levels/park-flat-bar.js';
import hubba from '../levels/park-hubba.js';
import curbCut from '../levels/park-curb-cut.js';
import funBox from '../levels/park-fun-box.js';
import bigSet from '../levels/park-big-set.js';
import copCar from '../levels/park-cop-car.js';
import { WORLD } from '../config.js';

// Stage 5: the skate park, the hardest stage. Ledges, a flat bar, a hubba, a
// curb cut, a fun box, a big three-step set and a cop car to finish, at sunset.
// Hubba and Big Set start up on their platforms, so a bank leads up to each
// from the section before.
const W = WORLD.W;
const G = WORLD.GROUND;
const HUBBA_TOP = G - 5 * 16; // the hubba section starts up on its platform
const SET_TOP = G - 3 * 48;

export default stage({
  id: 'stage-5',
  name: 'Stage 5',
  sections: [ledges, flatBar, hubba, curbCut, funBox, bigSet, copCar],
  extra: [
    // the ramps start well after the obstacle before, so you can land and roll first
    bank({ x: 2 * W - 90, run: 160, y1: G, y2: HUBBA_TOP }),
    bank({ x: 2 * W + 70, run: 50, y1: HUBBA_TOP, y2: HUBBA_TOP }),
    bank({ x: 5 * W - 130, run: 200, y1: G, y2: SET_TOP }),
    bank({ x: 5 * W + 70, run: 50, y1: SET_TOP, y2: SET_TOP }),
  ],
  camTop: 100,
  palette: 'park', // sunset sky
  sidewalk: true, // concrete skate park surface
  skyline: true, // a dusk city behind
});
