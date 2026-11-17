import { sawhorse, sign } from '../obstacles/index.js';

// Stage 3, section 4: two sawhorse barricades across the street. Ollie over
// the first, land, and pop again for the second.
export default {
  id: 'sawhorse',
  name: 'Barricade',
  obstacles: [sign({ x: 160 }), sawhorse({ x: 380 }), sawhorse({ x: 700 })],
};
