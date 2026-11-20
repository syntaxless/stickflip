import { bank, icePond, snowRail, summitFlag } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Frostbite, section 7: the summit jump. A sled kicker, a 320-wide crevasse, and an arched snowy rail hung
// over it. Safe line: ollie off the kicker and lock the arched rail for the ride across (ICE BRIDGE).
// Riskier: a charged ollie off the kicker clears the whole crevasse (CREVASSE JUMP). The summit flag
// stands on the far side.
const G = WORLD.GROUND;

export default {
  id: 'frost-crevasse',
  name: 'Crevasse Jump',
  obstacles: [
    bank({ x: 180, run: 130, y1: G, y2: G - 70, material: 'wood' }),
    icePond({ x: 310, width: 320, deep: true }),
    snowRail({ x: 400, length: 240, height: 100, arc: 40 }),
    summitFlag({ x: 780 }),
  ],
};
