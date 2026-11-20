import { tireHill, tireStack } from '../obstacles/index.js';

// Junkyard, section 1: three heaps of tyres, like whoops on a dirt track, then a tall stack. Roll over the
// heaps (or pop each crest); ollie the stack, or ride straight into it with the finger held to slappy-grind it.
export default {
  id: 'junk-tires',
  name: 'Tyre Heaps',
  cues: [{ x: 800, lead: 0.38, act: 'tap' }], // the rival's inputs (node scripts/solve-rival.mjs --write)
  obstacles: [tireHill({ x: 240 }), tireHill({ x: 400 }), tireHill({ x: 560 }), tireStack({ x: 800, w: 56, h: 36 })],
};
