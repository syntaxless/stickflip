import { rail, quarterPipe } from '../obstacles/index.js';

// Level 6: a long rail in front of a quarter pipe. Grind the rail, ride
// up the quarter pipe and air straight out of it (lots of hang time for
// tricks), drop back in, then grind the rail again on the way back
// out to the left. The rail starts 220 in from the screen's left edge, close
// enough that an ollie off the top of the Euro Gap (the stage's join into this
// section) lands on it: tap at the lip, then a second tap to lock the grind.
export default {
  id: 'quarter-pipe',
  name: 'Quarter Pipe',
  obstacles: [rail({ x: 220, length: 240, height: 64 }), quarterPipe({ x: 760, radius: 120 })],
  stars: [0, 700, 1500],
};
