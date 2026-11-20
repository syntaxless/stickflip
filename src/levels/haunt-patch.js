import { pumpkin, coffinUp } from '../obstacles/index.js';

// Haunted Night, section 4: a pumpkin patch. A pumpkin you can land on and ride off (PUMPKIN HOP), then a
// coffin stood on its end. Ollie both, or hop up on the pumpkin first.
export default {
  id: 'haunt-patch',
  name: 'Pumpkin Patch',
  obstacles: [pumpkin({ x: 330, w: 99, h: 36 }), coffinUp({ x: 720 })],
};
