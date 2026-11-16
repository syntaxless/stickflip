import { rail, quarterPipe } from '../obstacles/index.js';

// Level 6: a rail in front of a quarter pipe. Ollie or grind the rail, ride
// up the quarter pipe (tap on the way up to pop an air, and flip in it), drop
// back in, then ollie or grind the rail again on the way back out to the left.
export default {
  id: 'quarter-pipe',
  name: 'Quarter Pipe',
  hint: 'TAP GOING UP THE QUARTER TO POP AN AIR.',
  obstacles: [rail({ x: 330, length: 120, height: 64 }), quarterPipe({ x: 760, radius: 120 })],
  stars: [0, 700, 1500],
};
