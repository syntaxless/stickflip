import { lavaPit, bridgeRail } from '../obstacles/index.js';

// Hellride, section 3: a lava moat, 300 wide. A plain ollie flies about 245, so there
// are two ways over: lock a grind on the rail hung across it (ollie before the pit, tap
// just before the bar), or charge up (hold, then let go) for a long ollie across.
export default {
  id: 'hell-moat',
  name: 'Lava Moat',
  cues: [{ x: 300, lead: 0.37, act: 'tap' }, { x: 301, act: 'lock' }], // the rival's inputs (node scripts/solve-rival.mjs --write)
  obstacles: [lavaPit({ x: 300, width: 300 }), bridgeRail({ x: 300, length: 300, height: 56 })],
};
