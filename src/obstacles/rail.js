import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';

// A flat, low grind rail standing on two posts.
//
// Every obstacle is a plain object with the same shape, so the game logic
// never needs to know which kind it is dealing with:
//   surfaces: top edges the skater can touch from above.
//             { x1, x2, y, grindable, landable }
//             grindable -> a primed skater locks into a grind
//             landable  -> the skater can land and roll on top (boxes, ledges)
//             otherwise touching it from above is a bail
//   solids:   rectangles { x, y, w, h } that cause a slam when hit from the side
//   draw(g, fx): renders the obstacle into the pixel framebuffer (fx.time is the clock)
export function rail({ x, length, height, base = WORLD.GROUND }) {
  const top = base - height;
  const x2 = x + length;
  return {
    type: 'rail',
    surfaces: [{ x1: x, x2, y: top, grindable: true, landable: false }],
    solids: [{ x, y: top, w: length, h: height }],

    // g is the pixel framebuffer (see render/pixel.js); world units / 3 = pixels.
    draw(g) {
      const P = (v) => Math.round(v / 3);
      const [x1, x2p, y, ground] = [P(x), P(x2), P(top), P(base)];
      // Always black: no highlight or warning, the timing is on you.
      const bar = PAL.ink;
      for (const px of [P(x + 22), P(x2 - 22)]) {
        g.line(px, y + 2, px, ground - 1, PAL.ink);
        g.line(px - 2, ground - 1, px + 2, ground - 1, PAL.ink);
      }
      g.line(x1, y, x2p, y, bar);
      g.line(x1, y + 1, x2p, y + 1, bar);
    },
  };
}
