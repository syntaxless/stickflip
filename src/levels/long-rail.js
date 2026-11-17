import { scaffold, sign } from '../obstacles/index.js';

// Stage 3, section 5: scaffolding. Ollie onto the top pipe, lock the grind
// with a timed tap and ride it out.
export default {
  id: 'long-rail',
  name: 'Scaffold Rail',
  obstacles: [sign({ x: 200 }), scaffold({ x: 300, length: 430, height: 66 })],
};
