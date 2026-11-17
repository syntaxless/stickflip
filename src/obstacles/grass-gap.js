import { gap } from './gap.js';

// A gap that reads as a patch of grass: same fall-through physics as `gap`,
// but the renderer fills it with a sunken grass-and-dirt strip (see
// Renderer.drawBackground) instead of leaving a black hole.
export function grassGap({ x, width }) {
  return { ...gap({ x, width }), type: 'grass-gap', grass: { x1: x, x2: x + width } };
}
