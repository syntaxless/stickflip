import { carWreck } from '../obstacles/index.js';

// Junkyard, section 7: a wrecked car. Ollie up onto its roof and ride it, grind the roof edge, or fly the
// whole car. Roll off the end and you drop back to the street.
export default {
  id: 'junk-car',
  name: 'Car Roof',
  cues: [{ x: 360, lead: 0.41, act: 'tap' }], // the rival's inputs (node scripts/solve-rival.mjs --write)
  obstacles: [carWreck({ x: 360 })],
};
