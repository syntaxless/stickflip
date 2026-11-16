import { WORLD } from '../config.js';

// A bank: a straight slope in the ground from (x, y1) to (x + run, y2).
// Ride up one and its lip throws you into the air; land anywhere on one going
// down. Heights default to the street (WORLD.GROUND); it's all drawn as ground.
export function bank({ x, run, y1 = WORLD.GROUND, y2 = WORLD.GROUND }) {
  return {
    type: 'bank',
    surfaces: [],
    solids: [],
    ground: [{ x1: x, x2: x + run, y1, y2, landable: true }],
    draw() {},
  };
}
