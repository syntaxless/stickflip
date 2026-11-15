import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';

// A flat, low grind rail standing on two posts.
//
// Every obstacle is a plain object with the same shape, so the game logic
// never needs to know which kind it is dealing with:
//   surfaces: top edges the skater can touch from above.
//             { x1, x2, y, grindable, landable, trick }
//             grindable -> a primed skater locks into a grind
//             landable  -> the skater can land and roll on top (boxes, ledges)
//             otherwise touching it from above is a bail
//   solids:   rectangles { x, y, w, h } that cause a slam when hit from the side
//   draw(g, fx): renders the obstacle into the pixel framebuffer. fx.hint is 'ready' | 'primed' | null
export function rail({ x, length, height, trick = '50-50 GRIND' }) {
  const top = WORLD.GROUND - height;
  const x2 = x + length;
  return {
    type: 'rail',
    surfaces: [{ x1: x, x2, y: top, grindable: true, landable: false, trick }],
    solids: [{ x, y: top, w: length, h: height }],

    // g is the pixel framebuffer (see render/pixel.js); world units / 3 = pixels.
    draw(g, fx = {}) {
      const P = (v) => Math.round(v / 3);
      const [x1, x2p, y, ground] = [P(x), P(x2), P(top), P(WORLD.GROUND)];
      // Turns red once a grind is locked in. No advance warning: timing is on you.
      let bar = PAL.ink;
      if (fx.hint === 'primed') bar = PAL.red;
      for (const px of [P(x + 22), P(x2 - 22)]) {
        g.line(px, y + 2, px, ground - 1, PAL.ink);
        g.line(px - 2, ground - 1, px + 2, ground - 1, PAL.ink);
      }
      g.line(x1, y, x2p, y, bar);
      g.line(x1, y + 1, x2p, y + 1, bar);
    },
  };
}
