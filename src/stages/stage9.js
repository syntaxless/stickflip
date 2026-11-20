import { stage } from './compose.js';
import tires from '../levels/junk-tires.js';
import rail from '../levels/junk-rail.js';
import sludge from '../levels/junk-sludge.js';
import appliances from '../levels/junk-appliances.js';
import bar from '../levels/junk-bar.js';
import crane from '../levels/junk-crane.js';
import car from '../levels/junk-car.js';
import magnet from '../levels/junk-magnet.js';
import finish from '../levels/junk-finish.js';

// Stage 9: JUNKYARD, a second race, harder than Hellride. A computer-controlled rival skates the same course
// (see rival.js) and the first across the finish line wins. This rival is quicker (it cruises at your pace and
// barely eases off when you fall behind), so you have to take the grinds and gaps for the turbo to beat it.
// Rails, the wrecking ball and named gaps kick the turbo in. Tyre heaps, a scrap rail, a sludge pit, fridges,
// a pipe bar, a crane, a wrecked car, the magnet jump and the finish straight.
export default stage({
  id: 'stage-9',
  name: 'Junkyard',
  sections: [tires, rail, sludge, appliances, bar, crane, car, magnet, finish],
  race: { finishAt: 760, pace: 1.0, easeOffMax: 0.03 },
  boost: true, // grinds, the wrecking ball and named gaps kick the speed up
  speedReturn: 40, // ...and it fades slowly
  camTop: 100,
  palette: 'junk',
  junk: true, // the sky and the ground
  gameCenter: false, // no Game Center board yet: create stickflip.stage9 in App Store Connect, then drop this
});
