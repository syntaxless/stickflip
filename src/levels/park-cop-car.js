import { woodRamp, copCar } from '../obstacles/index.js';

// Stage 5, section 7 (the finale): a wooden ramp up to a police car facing you.
// Ollie off the top of the ramp and grind the light bar on its roof, then drop
// down the far side. Roll into the car and you slam.
export default {
  id: 'park-cop-car',
  name: 'Cop Car',
  obstacles: [woodRamp({ x: 280, run: 170, rise: 60 }), copCar({ x: 450 })],
};
