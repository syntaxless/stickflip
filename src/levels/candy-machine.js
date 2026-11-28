import { terrain, caneRail, candyMachine } from '../obstacles/index.js';

// Candy Land, section 9 (the last): a last candy cane for the turbo, then the giant candy machine. Ride the conveyor
// into its dispenser: a gumball rolls out and the confetti flies. (The finish is `finishAt` in stage11.js.)
export default {
  id: 'candy-machine',
  name: 'Candy Machine',
  obstacles: [terrain([['flat', 0, 960, 0]]), caneRail({ x: 335, length: 140, height: 50 }), candyMachine({ x: 470 })],
};
