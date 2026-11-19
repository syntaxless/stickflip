import { brokenGap, brokenSlab, dumpTruck, sign } from '../obstacles/index.js';

// Stage 3, section 7 (the finale): a broken slab of sidewalk tilted up as a kicker, and a big gap full of rubble where the sidewalk has broken away. Ollie off the lip.
// Past the gap a dump truck full of gravel is parked facing right (the stage runs on past the end of this screen
// to make room, see `tail` in stage3.js): grind its bed rim and it dumps the gravel out, ollie onto its cab, or clear the lot with a charged ollie.

export default {
  id: 'big-gap',
  name: 'Big Gap',
  obstacles: [sign({ x: 180 }), brokenSlab({ x: 280, run: 120, rise: 60 }), brokenGap({ x: 400, width: 240 }), dumpTruck({ x: 940 })],
};
