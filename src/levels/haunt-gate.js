import { bank, openGrave, fenceRail, mansion } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Haunted Night, section 7: the mansion gate. A coffin-lid kicker, a 320-wide moat of the dead, and a wrought
// iron fence arched over it. Safe line: ollie off the kicker and lock the arch (GATE GRIND). Riskier: a
// charged ollie clears the whole moat (MANSION LEAP). The haunted mansion stands on the far side.
const G = WORLD.GROUND;

export default {
  id: 'haunt-gate',
  name: 'Mansion Gate',
  obstacles: [
    bank({ x: 180, run: 130, y1: G, y2: G - 70, material: 'wood' }),
    openGrave({ x: 310, width: 320, deep: true }),
    fenceRail({ x: 400, length: 240, height: 100, arc: 40 }),
    mansion({ x: 790 }),
  ],
};
