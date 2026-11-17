import { rock, sign } from '../obstacles/index.js';

// Stage 3, section 1: a tiny rock. Ride into it and the board stops and you
// fly off; a small ollie clears it.
export default {
  id: 'rock',
  name: 'Rock',
  obstacles: [sign({ x: 250 }), rock({ x: 500 })],
};
