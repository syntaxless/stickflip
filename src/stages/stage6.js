import { stage } from './compose.js';
import { bank } from '../obstacles/index.js';
import bumps from '../levels/hell-bumps.js';
import cinderRail from '../levels/hell-rail.js';
import moat from '../levels/hell-moat.js';
import hurdles from '../levels/hell-hurdles.js';
import bar from '../levels/hell-bar.js';
import firePit from '../levels/hell-fire-pit.js';
import devilStairs from '../levels/hell-stairs.js';
import hellmouth from '../levels/hell-mouth.js';
import finish from '../levels/hell-finish.js';
import { WORLD } from '../config.js';

// Stage 6: HELLRIDE. A race, not a run: a computer-controlled rival skates the same course (see
// rival.js) and the first across the finish line wins. Rails, ring of fire and named gaps kick the
// turbo in, and the course is built around jump distances: some gaps need the turbo or a
// charged ollie, and each has a safer line (a rail across).
// The devil's stairs start up on a platform, so a bank leads up to it from the fire pit before.
const W = WORLD.W;
const G = WORLD.GROUND;
const TOP = G - 5 * 16;

export default stage({
  id: 'stage-6',
  name: 'Hellride',
  sections: [bumps, cinderRail, moat, hurdles, bar, firePit, devilStairs, hellmouth, finish],
  extra: [
    bank({ x: 6 * W - 130, run: 200, y1: G, y2: TOP }),
    bank({ x: 6 * W + 70, run: 60, y1: TOP, y2: TOP }),
  ],
  race: { finishAt: 760 },
  boost: true, // grinds, rings and named gaps kick the speed up
  speedReturn: 40, // ...and it fades slowly
  camTop: 100,
  palette: 'hell',
  hell: true, // the sky and the ground
});
