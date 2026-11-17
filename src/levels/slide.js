import { playSlide } from '../obstacles/index.js';

// Stage 4, section 2: a slide. A tall platform with a yellow chute curving down
// from its edge. There's no ramp up: ollie onto the slide (over the platform
// onto the chute, tap or hold as you land to lock the grind) and ride it down.
export default {
  id: 'slide',
  name: 'Slide',
  obstacles: [playSlide({ x: 380 })],
};
