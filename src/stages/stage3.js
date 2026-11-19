import { stage } from './compose.js';
import { bank } from '../obstacles/index.js';
import rock from '../levels/rock.js';
import coneRow from '../levels/cone-row.js';
import sawhorse from '../levels/sawhorse.js';
import ledgeToGap from '../levels/ledge-to-gap.js';
import longRail from '../levels/long-rail.js';
import bigDrop from '../levels/big-drop.js';
import bigGap from '../levels/big-gap.js';
import { WORLD } from '../config.js';

// Stage 3: a construction site. A rock, a row of cones, a barrier into a gap,
// a barricade, a long rail, a big drop with a barrel at the bottom and a big gap to finish. Big Drop
// starts up on its platform, so a bank leads up to it from the section before.
const W = WORLD.W;
const G = WORLD.GROUND;
const SET_TOP = G - 6 * 18;

export default stage({
  id: 'stage-3',
  name: 'Stage 3',
  sections: [rock, coneRow, ledgeToGap, sawhorse, longRail, bigDrop, bigGap],
  // the ramp starts well after the scaffold rail (330 of flat street between) so you can land and roll first
  extra: [bank({ x: 5 * W, run: 60 }), bank({ x: 5 * W + 60, run: 160, y1: G, y2: SET_TOP, material: 'concrete' }), bank({ x: 5 * W + 220, run: 50, y1: SET_TOP, y2: SET_TOP, material: 'concrete' })],
  // a replay starts on the street just before the ramp, with the scaffold well behind
  starts: { 2: 40, 4: 0, 5: -40 }, // 3-3 and 3-5 spawn further back (more run-up before the barrier and the rail)
  tail: 240, // the dump truck at the end of Dumper stands past the last screen
  camTop: 100,
  palette: 'site', // light grey sky
  sidewalk: true, // rides on a concrete sidewalk
  skyline: true, // with a faint, parallax city
});
