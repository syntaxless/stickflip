import { terrain, belt, spinner } from '../obstacles/index.js';

// Candy Land, section 8: the machine room. The gumball stops chasing you here. A conveyor carries you along,
// a spinning lollipop bar sweeps across the floor (time it: ollie through, or brake and go when it is clear), and a
// backwards belt holds you up after it.
export default {
  id: 'candy-floor',
  name: 'Sweet Machine',
  obstacles: [
    terrain([['flat', 0, 960, 0]]),
    belt({ x: 140, w: 250, v: 110 }),
    spinner({ x: 520, cy: 132, r: 76, w: 2.0, phase: 0.9 }),
    belt({ x: 700, w: 200, v: -100 }),
  ],
};
