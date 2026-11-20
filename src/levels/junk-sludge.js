import { sludgePit, steelBeam } from '../obstacles/index.js';

// Junkyard, section 3: a 300-wide pit of toxic sludge with a steel beam hung across it. Ollie and lock the
// beam to ride across (SLUDGE GRIND), or charge one long jump. Short of the far side is a swim.
export default {
  id: 'junk-sludge',
  name: 'Sludge Pit',
  cues: [{ x: 300, lead: 0.36, act: 'tap' }, { x: 301, act: 'lock' }], // the rival's inputs (node scripts/solve-rival.mjs --write)
  obstacles: [sludgePit({ x: 300, width: 300 }), steelBeam({ x: 300, length: 300, height: 56 })],
};
