import { rail, quarterPipe } from '../obstacles/index.js';

// Level 6: a rail in front of a quarter pipe. Ollie or grind the rail, ride
// up the quarter pipe, air out of it (tricks too) and come back down, then
// ollie or grind the rail again on the way back out to the left.
export default {
  id: 'quarter-pipe',
  name: 'Quarter Pipe',
  hint: 'GRIND IN, AIR THE QUARTER, GRIND BACK OUT.',
  obstacles: [rail({ x: 330, length: 120, height: 64 }), quarterPipe({ x: 760, radius: 120 })],
  stars: [0, 700, 1500],
};
