import { seaGap, ropeRail } from '../obstacles/index.js';

// Boardwalk, section 3: the planks are gone and the sea runs under the pier, 300 wide. A rope rail is
// strung across it. Safe line: ollie onto the rope and grind it across (ROPE GRIND). Riskier: a charged
// ollie flies the whole gap (SEA LEAP). Short of the far side is a swim.
export default {
  id: 'beach-sea',
  name: 'Sea Gap',
  obstacles: [seaGap({ x: 300, width: 260 }), ropeRail({ x: 310, length: 250, height: 40 })],
};
