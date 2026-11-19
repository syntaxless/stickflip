import { brokenGap, brokenSlab, dumpTruck, sign } from '../obstacles/index.js';

// Stage 3, section 7 (the finale): a broken slab of sidewalk tilted up as a kicker, and a big gap full of rubble where the sidewalk has broken away. Ollie off the lip.
// A dump truck full of gravel is parked facing right, just past the gap (the stage runs on past the end of this screen
// to make room, see `tail` in stage3.js). From the one pop off the slab: a charged ollie carries over the gap and the bed
// onto the cab, the same pop with the finger held locks a grind on the bed rim (and it dumps the gravel out), and a plain
// ollie only just clears the gap.

export default {
  id: 'big-gap',
  name: 'Big Gap',
  obstacles: [sign({ x: 180 }), brokenSlab({ x: 280, run: 120, rise: 60 }), brokenGap({ x: 400, width: 240 }), dumpTruck({ x: 680 })],
};
