import { stage } from './compose.js';
import { bank } from '../obstacles/index.js';
import rock from '../levels/rock.js';
import coneRow from '../levels/cone-row.js';
import sawhorse from '../levels/sawhorse.js';
import ledgeToGap from '../levels/ledge-to-gap.js';
import longRail from '../levels/long-rail.js';
import bigSet from '../levels/big-set.js';
import bigGap from '../levels/big-gap.js';
import { WORLD } from '../config.js';

// Stage 3: a construction site. A rock, a row of cones, a barrier into a gap,
// a barricade, a long rail, a six-stair set and a big gap to finish. Big Set
// starts up on its platform, so a bank leads up to it from the section before.
const W = WORLD.W;
const G = WORLD.GROUND;
const SET_TOP = G - 6 * 18;

export default stage({
  id: 'stage-3',
  name: 'Stage 3',
  sections: [rock, coneRow, ledgeToGap, sawhorse, longRail, bigSet, bigGap],
  extra: [bank({ x: 5 * W - 210, run: 160, y1: G, y2: SET_TOP }), bank({ x: 5 * W - 50, run: 50, y1: SET_TOP, y2: SET_TOP })],
  camTop: 100,
  palette: 'site', // light grey sky
  sidewalk: true, // rides on a concrete sidewalk
  skyline: true, // with a faint, parallax city
});
