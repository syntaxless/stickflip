import { sludgePit, wreckBall } from '../obstacles/index.js';

// Junkyard, section 6: a 200-wide sludge pit with a crane's wrecking ball swinging over it. Jump through the
// opening under the ball for a bonus and a turbo kick; head above the chain and it hits you.
export default {
  id: 'junk-crane',
  name: 'Wrecking Ball',
  cues: [{ x: 330, lead: 0.16, act: 'tap' }], // the rival's inputs (node scripts/solve-rival.mjs --write)
  obstacles: [sludgePit({ x: 330, width: 200 }), wreckBall({ x: 430, top: 290, bottom: 110 })],
};
