import { box, hydrant } from '../obstacles/index.js';

// Stage 2, section 5: a long bench, then a fire hydrant. Ollie over the lot,
// land on the bench and roll off, or grind it and pop off the end over the
// hydrant (BENCH TO HYDRANT).
export default {
  id: 'bench',
  name: 'Bench',
  obstacles: [box({ x: 380, w: 240, h: 42, landable: true, grindable: true, paint: 'bench' }), hydrant({ x: 700 })],
};
