import { sandDune, sandcastle } from '../obstacles/index.js';

// Boardwalk, section 1: two sand dunes blown across the planks, then a sandcastle in the road. Roll over
// the dunes (or pop each crest for air), then ollie the castle: a plain ollie, or a charged one for more air.
export default {
  id: 'beach-dunes',
  name: 'Sand Dunes',
  obstacles: [sandDune({ x: 240 }), sandDune({ x: 430 }), sandcastle({ x: 800 })],
};
