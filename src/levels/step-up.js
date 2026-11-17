import { stepsUp, citySign } from '../obstacles/index.js';

// Stage 2, section 2: three steps up to a ledge. Ollie all the way onto the
// top (a lower step or a riser is a bail), then roll off the far end.
export default {
  id: 'step-up',
  name: 'Step Up',
  obstacles: [citySign({ x: 130 }), stepsUp({ x: 440, steps: 3, run: 45, rise: 25 })], // the sign is background decor
};
