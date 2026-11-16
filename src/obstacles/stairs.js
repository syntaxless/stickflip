import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';

// A set of stairs going down to the right, starting from a raised platform at
// x. `steps` is the number of drops; each is `rise` tall, with `run`-long treads
// between them. Landing on a tread is a bail, so ollie (or flip) all the way
// down. With `handrail`, a sloped rail runs alongside the stairs: it's beside
// them, so you pass it unless you tap just before it to grind it down.
export function stairs({ x, steps = 5, run = 46, rise = 16, handrail = true, railHeight = 50 }) {
  const top = WORLD.GROUND - steps * rise;
  const end = x + (steps - 1) * run; // bottom of the stairs
  const ground = [{ x1: -Infinity, x2: x, y: top, landable: true }];
  for (let i = 1; i < steps; i++) {
    ground.push({ x1: x + (i - 1) * run, x2: x + i * run, y: top + i * rise, landable: false, bail: 'stairs' });
  }
  const rail = { x1: x, x2: end, y1: top - railHeight, y2: WORLD.GROUND - railHeight, grindable: true, passable: true, landable: false };

  return {
    type: 'stairs',
    surfaces: handrail ? [rail] : [],
    solids: [],
    ground,
    // The platform and steps are drawn as part of the ground; this adds the rail.
    draw(g) {
      if (!handrail) return;
      const P = (v) => Math.round(v / 3);
      const bar = PAL.ink; // never highlighted
      // posts down to the tread below each one
      for (const px of [x + run * 0.5, end - run * 0.5]) {
        const ry = rail.y1 + ((rail.y2 - rail.y1) * (px - x)) / (end - x);
        const i = Math.floor((px - x) / run) + 1;
        g.line(P(px), P(ry) + 1, P(px), P(top + i * rise) - 1, PAL.ink);
      }
      g.line(P(x), P(rail.y1), P(end), P(rail.y2), bar);
      g.line(P(x), P(rail.y1) + 1, P(end), P(rail.y2) + 1, bar);
    },
  };
}
