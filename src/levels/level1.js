import { dirtGap } from '../obstacles/index.js';

// Level 1: a gap in the street, filled with a patch of dirt. Ollie just before the edge to clear it; go
// too early and you come up short, too late and you roll in. A trick in the
// air is worth points, but it has to finish before you land.
export default {
  id: 'first-gap',
  name: 'First Gap',
  obstacles: [dirtGap({ x: 430, width: 130, kind: 'gravel' })],
};
