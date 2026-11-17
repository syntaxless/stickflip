import { sawhorse, sign } from '../obstacles/index.js';

// Stage 3, section 4: a sawhorse barricade across the street. Ollie over it.
export default {
  id: 'sawhorse',
  name: 'Barricade',
  obstacles: [sign({ x: 250 }), sawhorse({ x: 520 })],
};
