import { gravestone, lanternGate } from '../obstacles/index.js';

// Haunted Night, section 5: a gravestone, then a lantern gate you can jump through for a bonus (GHOST GATE)
// or skate under; head above the crossbar and you hit it. Then a taller stone and a gold gate (WILL-O-WISP).
export default {
  id: 'haunt-gates',
  name: 'Lantern Gates',
  obstacles: [
    gravestone({ x: 380, w: 44, h: 40, kind: 'cross' }),
    lanternGate({ x: 520, top: 300, bottom: 110 }),
    gravestone({ x: 690, w: 44, h: 44 }),
    lanternGate({ x: 830, top: 300, bottom: 110, name: 'WILL-O-WISP', points: 300 }),
  ],
};
