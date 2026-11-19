import { barricade } from '../obstacles/index.js';

// Hellride, section 4: two basalt hurdles 440 apart, like Excitebike's hay bales. Ollie each
// one, grind the top of one, or hold for a charged ollie that clears them in one go.
export default {
  id: 'hell-hurdles',
  name: 'Imp Hurdles',
  cues: [{ x: 340, lead: 0.35, act: 'tap' }, { x: 780, lead: 0.34, act: 'tap' }], // the rival's inputs (node scripts/solve-rival.mjs --write)
  obstacles: [barricade({ x: 340, w: 56, h: 40 }), barricade({ x: 780, w: 56, h: 40 })],
};
