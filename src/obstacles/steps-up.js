import { WORLD } from '../config.js';

// Stairs going up to the right from height `base`, to a platform that runs on
// to the end of the screen. You can't ride up stairs, so ollie all the way
// onto the top: landing on a lower step is a bail, and so is hitting a riser.
export function stepsUp({ x, steps = 2, run = 40, rise = 25, base = WORLD.GROUND, material }) {
  const ground = [];
  for (let i = 0; i < steps - 1; i++) {
    ground.push({ x1: x + i * run, x2: x + (i + 1) * run, y: base - (i + 1) * rise, landable: false, bail: 'step', wall: 'stairsUp', ...(material && { material }) });
  }
  ground.push({ x1: x + (steps - 1) * run, x2: Infinity, y: base - steps * rise, landable: true, wall: 'stairsUp', ...(material && { material }) });
  return { type: 'stepsUp', surfaces: [], solids: [], ground, draw() {} };
}
