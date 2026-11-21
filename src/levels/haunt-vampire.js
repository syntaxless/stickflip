import { vampireCoffin } from '../obstacles/index.js';

// Graveyard, section 8 (the last): the vampire's coffin. Ollie up onto it and ride it, or lock a grind on its
// edge for VAMPIRE GRIND: the grind knocks the lid ajar and a flock of bats flies out. Roll off the end
// and drop back to the street.
export default {
  id: 'haunt-vampire',
  name: 'Vampire Coffin',
  obstacles: [vampireCoffin({ x: 360 })],
};
