import { gap } from './gap.js';

// A gap that reads as a patch of bare dirt: same fall-through physics as
// `gap`, but the renderer fills it with a sunken strip of the ground's dirt
// (no grass on top) instead of leaving a black hole. See Renderer.drawBackground.
export function dirtGap({ x, width }) {
  return { ...gap({ x, width }), type: 'dirt-gap', dirt: { x1: x, x2: x + width } };
}
