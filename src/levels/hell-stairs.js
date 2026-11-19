import { stairs } from '../obstacles/index.js';

// Hellride, section 6: the devil's stairs. Start up on the platform (a bank leads up to it from the
// section before), five stairs down with a handrail beside them. Ollie the set, or tap just before
// the handrail to grind it down.
export default {
  id: 'hell-stairs',
  name: "Devil's Stairs",
  cues: [{ x: 420, lead: 0.36, act: 'tap' }, { x: 421, act: 'lock' }], // the rival's inputs (node scripts/solve-rival.mjs --write)
  obstacles: [stairs({ x: 420, steps: 5, run: 46, rise: 16, material: 'concrete' })],
};
