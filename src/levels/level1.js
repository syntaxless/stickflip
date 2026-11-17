import { grassGap } from '../obstacles/index.js';

// Level 1: a gap in the street, filled with a patch of grass. Ollie just before the edge to clear it; go
// too early and you come up short, too late and you roll in. A trick in the
// air is worth stars, but it has to finish before you land.
export default {
  id: 'first-gap',
  name: 'First Gap',
  obstacles: [grassGap({ x: 430, width: 130 })],
  // Score needed for 1, 2 and 3 stars. Star 1 just means "made it".
  stars: [0, 150, 300],
};
