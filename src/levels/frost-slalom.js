import { iceBlock, skiGate } from '../obstacles/index.js';

// Frostbite, section 5: a slalom. An ice block, then a ski gate right after it: the arc of your ollie
// takes you through the opening for a bonus (SLALOM GATE), or ride under it. Head above the banner
// and you hit it, so don't flip too high. Twice.
export default {
  id: 'frost-slalom',
  name: 'Slalom',
  obstacles: [
    iceBlock({ x: 380, w: 50, h: 36 }),
    skiGate({ x: 520, top: 300, bottom: 110 }),
    iceBlock({ x: 690, w: 50, h: 44 }),
    skiGate({ x: 830, top: 300, bottom: 110, name: 'GOLD GATE', points: 300 }),
  ],
};
