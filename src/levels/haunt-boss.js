import { vampireBoss } from '../obstacles/index.js';

// Graveyard, section 8 (the last): the vampire boss. He paces to and fro on the street; touch his side and he
// bites. Land on his head with the wooden stake from 10-7 and it drives into him. Without the stake he throws
// you off, and a bail sends you back to 10-7 to fetch it.
export default {
  id: 'haunt-boss',
  name: 'Vampire Boss',
  requires: 'stake', // only a checkpoint with the stake in hand (see Game.checkSection)
  obstacles: [vampireBoss({ x: 660 })],
};
