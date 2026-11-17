import { slideChute, slideLadder } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Stage 4, section 2: a slide, raised on legs. Ride up the ladder and
// roll off the top with your finger held to lock onto the chute and grind it
// down; let go and you clip it. The chute ends 24 above the street.
const G = WORLD.GROUND;

export default {
  id: 'slide',
  name: 'Slide',
  obstacles: [
    slideLadder({ x: 260, run: 120, rise: 70, deck: 60 }),
    slideChute({ x1: 440, y1: G - 70, x2: 700, y2: G - 24 }),
  ],
};
