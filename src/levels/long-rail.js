import { scaffold, sign } from '../obstacles/index.js';

// Stage 3, section 5: scaffolding. Ollie onto the top pipe, lock the grind
// with a timed tap and ride it out. The rail ends 180 units before the
// ramp up to Big Set (see stages/stage3.js), room to land and roll.
export default {
  id: 'long-rail',
  name: 'Scaffold Rail',
  obstacles: [sign({ x: 160 }), scaffold({ x: 260, length: 430, height: 66 })],
};
