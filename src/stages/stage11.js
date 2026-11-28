import { stage } from './compose.js';
import start from '../levels/candy-start.js';
import gap from '../levels/candy-gap.js';
import stairs from '../levels/candy-stairs.js';
import lane from '../levels/candy-lane.js';
import ridge from '../levels/candy-ridge.js';
import run from '../levels/candy-run.js';
import hills from '../levels/candy-hills.js';
import floor from '../levels/candy-floor.js';
import machine from '../levels/candy-machine.js';

// Stage 11: CANDY LAND. The ground follows a hand-drawn sketch (raised platforms and rails, a pit, stairs down, a
// low run of rails, a second big pit, rolling hills with kickers and rails) and then it gets sweet: from 11-6 a
// giant gumball rolls after you (sticky caramel slows you, rails and gaps give you the turbo to stay ahead), and the
// stage ends at an animated candy machine: ride the conveyor into the dispenser, past spinning lollipops, for a
// giant gumball and confetti. Opens when Stage 10 is finished.
const SECTION = 960;
export default stage({
  id: 'stage-11',
  name: 'Candy Land',
  sections: [start, gap, stairs, lane, ridge, run, hills, floor, machine],
  chase: { from: 5 * SECTION + 40, until: 7 * SECTION, gap: 210, pace: 1.06, r: 92, warn: 340, intro: 2.4 }, // the gumball (see Game.updateChase)
  finishAt: 740, // the dispenser mouth
  tail: 120, // room for the machine's far side
  finale: true, // a beat of confetti before the score screen (see main.js)
  boost: true, // grinds and named gaps kick the speed up, to stay ahead of the gumball
  speedReturn: 40,
  camTop: 100,
  palette: 'candy',
  candy: true, // the sky and the ground
  gameCenter: false, // until the stickflip.stage11 board exists in App Store Connect
});
