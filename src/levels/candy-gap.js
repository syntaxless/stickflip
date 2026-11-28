import { terrain } from '../obstacles/index.js';

// Candy Land, section 2: the first big pit. Ollie off the high platform and land on the lower flat beyond (a charged
// ollie gives plenty of room).
export default {
  id: 'candy-gap',
  name: 'Gumdrop Gap',
  obstacles: [terrain([['flat', 0, 340, 152], ['pit', 340, 580], ['flat', 580, 960, 112]])],
};
