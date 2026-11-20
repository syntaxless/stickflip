import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';
import { gap } from './gap.js';

// Small helpers shared by the themed stages' obstacles (Boardwalk, Junkyard, Haunted Night): the
// pixel scale, a stable hash, a gate that hangs a hazard in the air, and a pit with things floating in it.
export const P = (v) => Math.round(v / 3);
export const G = WORLD.GROUND;
export const { ink } = PAL;

export const hash = (a, b) => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
};

// A gate: head above `top` (height over the street) hits it, head between `bottom` and `top` goes
// through it for `points`, and below `bottom` you pass underneath (a rider standing on the street does).
// Same rules as a ring of fire (see Game.passHazards). `paint(g, fx, hazard)` draws it.
export function gate({ type, x, top, bottom, name, points, paint }) {
  const hazard = { x, top: G - top, bottom: G - bottom, reason: 'gate', trick: name, points };
  return {
    type,
    surfaces: [],
    solids: [],
    hazards: [hazard],
    draw(g, fx = {}) {
      paint(g, fx, hazard);
    },
  };
}

// A pit where the street should be: come up short and you drop in with a splash (a gap bail). `floes` are
// flat things floating in it, flush with the street, that you can land on and ollie off.
// `paint(g, fx, { l, r, top })` draws the filling (pixel columns l..r, `top` the street's row).
export function pit({ type, x, width, floes = [], kind = 'water', paint, paintFloe }) {
  const hole = gap({ x, width });
  return {
    ...hole,
    type,
    surfaces: floes.map((f) => ({ x1: x + f.x, x2: x + f.x + f.w, y: G, landable: true, grindable: false })),
    splash: { x1: x, x2: x + width, y: G, kind },
    draw(g, fx = {}) {
      const [l, r] = [P(x), P(x + width) - 1];
      const top = P(G) - 1;
      paint(g, fx, { l, r, top });
      for (const f of floes) paintFloe?.(g, fx, { l: P(x + f.x), r: P(x + f.x + f.w) - 1, top });
    },
  };
}
