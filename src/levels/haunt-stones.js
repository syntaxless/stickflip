import { gravestone, graveMound } from '../obstacles/index.js';

// Haunted Night, section 1: a low gravestone, a fresh grave mound, then a tall monument. Ollie the stones
// (or slappy the low one with the finger held), roll over the mound, and ollie the monument.
export default {
  id: 'haunt-stones',
  name: 'Tombstones',
  obstacles: [gravestone({ x: 360, w: 40, h: 36 }), graveMound({ x: 530, run: 90, h: 28 }), gravestone({ x: 830, w: 42, h: 66, kind: 'obelisk' })],
};
