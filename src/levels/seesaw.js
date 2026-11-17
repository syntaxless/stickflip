import { seesaw } from '../obstacles/index.js';

// Stage 4, section 4: a seesaw plank. Ollie on, lock the grind with a timed tap and ride it out.
export default {
  id: 'seesaw',
  name: 'Seesaw',
  obstacles: [seesaw({ x: 400, length: 280, height: 42 })],
};
