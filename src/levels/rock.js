import { rock, hydrant, sign } from '../obstacles/index.js';

// Stage 3, section 1: a tiny rock, then a fire hydrant. Ride into the rock
// and the board stops and you fly off; a small ollie clears it. The hydrant
// is the same deal, a little further on.
export default {
  id: 'rock',
  name: 'Rock',
  obstacles: [sign({ x: 250 }), rock({ x: 480 }), hydrant({ x: 800 })],
};
