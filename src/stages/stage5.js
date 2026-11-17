import { stage } from './compose.js';
import { bank } from '../obstacles/index.js';
import ledges from '../levels/park-ledges.js';
import flatBar from '../levels/park-flat-bar.js';
import hubba from '../levels/park-hubba.js';
import bowl from '../levels/park-bowl.js';
import funBox from '../levels/park-fun-box.js';
import bigSet from '../levels/park-big-set.js';
import finalGap from '../levels/park-final-gap.js';
import { WORLD } from '../config.js';

// Stage 5: the skate park, the hardest stage. Ledges, a flat bar, a hubba, a
// bowl, a fun box, a six-stair set and the biggest gap to finish, at sunset.
// Hubba and Big Set start up on their platforms, so a bank leads up to each
// from the section before.
const W = WORLD.W;
const G = WORLD.GROUND;
const HUBBA_TOP = G - 5 * 16;
const SET_TOP = G - 6 * 18;

export default stage({
  id: 'stage-5',
  name: 'Stage 5',
  sections: [ledges, flatBar, hubba, bowl, funBox, bigSet, finalGap],
  extra: [
    bank({ x: 2 * W - 210, run: 160, y1: G, y2: HUBBA_TOP }),
    bank({ x: 2 * W - 50, run: 50, y1: HUBBA_TOP, y2: HUBBA_TOP }),
    bank({ x: 5 * W - 210, run: 160, y1: G, y2: SET_TOP }),
    bank({ x: 5 * W - 50, run: 50, y1: SET_TOP, y2: SET_TOP }),
  ],
  camTop: 100,
  palette: 'park', // sunset sky
  sidewalk: true, // concrete skate park surface
  skyline: true, // a dusk city behind
});
