import { beachBall, surfRack, bunting } from '../obstacles/index.js';

// Boardwalk, section 5: a beach ball, then a string of bunting you can jump through for a bonus (BEACH
// FLAG) or skate under; head above the string and you tangle in it. Then a surfboard rack and a gold
// string (LUCKY FLAG).
export default {
  id: 'beach-flags',
  name: 'Bunting',
  obstacles: [
    beachBall({ x: 380 }),
    bunting({ x: 520, top: 300, bottom: 110 }),
    surfRack({ x: 690 }),
    bunting({ x: 830, top: 300, bottom: 110, name: 'LUCKY FLAG', points: 300 }),
  ],
};
