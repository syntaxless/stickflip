import { box } from '../obstacles/index.js';

// Stage 2, section 3: a tall trash can in the middle of the street. Only a
// well-timed ollie gets over it; the lid is no place to land.
export default {
  id: 'trash-can',
  name: 'Trash Can',
  obstacles: [box({ x: 450, w: 45, h: 135, lid: true })],
};
