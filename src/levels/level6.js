import { rail, quarterPipe } from '../obstacles/index.js';

// Level 6: a long rail in front of a quarter pipe. Grind the rail, ride
// up the quarter pipe and air straight out of it (lots of hang time for
// tricks), drop back in, then grind the rail again on the way back
// out to the left.
export default {
  id: 'quarter-pipe',
  name: 'Quarter Pipe',
  hint: 'AIR OUT OF THE QUARTER. SWIPE FOR TRICKS.',
  obstacles: [rail({ x: 330, length: 240, height: 64 }), quarterPipe({ x: 760, radius: 120 })],
  stars: [0, 700, 1500],
};
