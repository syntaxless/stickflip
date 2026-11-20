import { bank, seaGap, boardRail, pierSign } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Boardwalk, section 7: the end of the pier. A wooden kicker, a 320-wide gap over the open sea, and a
// lifebuoy rail arched across it. Safe line: ollie off the kicker and lock the rail for the ride across
// (PIER BRIDGE). Riskier: a charged ollie off the kicker clears the whole gap (PIER LEAP). The sign
// stands on the far side.
const G = WORLD.GROUND;

export default {
  id: 'beach-pier-end',
  name: 'Pier End',
  obstacles: [
    bank({ x: 180, run: 130, y1: G, y2: G - 70, material: 'wood' }),
    seaGap({ x: 310, width: 320 }),
    boardRail({ x: 400, length: 240, height: 100, arc: 40 }),
    pierSign({ x: 780 }),
  ],
};
