import { appliance } from '../obstacles/index.js';

// Junkyard, section 4: a fridge, then a washer, dumped in the road. Ollie each one, or grind a top edge.
export default {
  id: 'junk-appliances',
  name: 'Fridge Row',
  cues: [{ x: 340, lead: 0.35, act: 'tap' }, { x: 780, lead: 0.33, act: 'tap' }], // the rival's inputs (node scripts/solve-rival.mjs --write)
  obstacles: [appliance({ x: 340, w: 54, h: 44, kind: 'fridge' }), appliance({ x: 780, w: 60, h: 46, kind: 'washer' })],
};
