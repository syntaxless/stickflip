import { rock, citySign } from '../obstacles/index.js';

// The very first obstacle: a small rock in the road. Roll into it and the
// board stops dead; any ollie lifts you over.
export default {
  id: 'first-rock',
  name: 'First Rock',
  // the OSLO CITY LIMITS sign stands just past the rock: background decor, no hitbox
  obstacles: [rock({ x: 500 }), citySign({ x: 640 })],
};
