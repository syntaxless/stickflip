import { rock } from '../obstacles/index.js';

// The very first obstacle: a small rock in the road. Roll into it and the
// board stops dead; any ollie lifts you over.
export default {
  id: 'first-rock',
  name: 'First Rock',
  obstacles: [rock({ x: 500 })],
};
