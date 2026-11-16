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
// arc: how much higher the middle is than the ends (a "rainbow rail");
// 0 is a straight, flat rail.
export function rail({ x, length, height, base = WORLD.GROUND, arc = 0 }) {
  const top = base - height; // the ends
  const x2 = x + length;
  const surface = { x1: x, x2, y: top, grindable: true, landable: false };
  if (arc) surface.arc = arc;
  const yAt = (px) => {
    const t = (px - x) / length;
    return top - arc * 4 * t * (1 - t);
  };
  // Side-on, the rail and its posts are a wall: strips under the bar, each
  // topped at the lower of its two ends so landing on the bar still counts.
  const STRIPS = arc ? 8 : 1;
  const w = length / STRIPS;
  const solids = Array.from({ length: STRIPS }, (_, i) => {
    const sy = Math.max(yAt(x + i * w), yAt(x + (i + 1) * w));
    return { x: x + i * w, y: sy, w, h: base - sy };
  });
  return {
    type: 'rail',
    surfaces: [surface],
    solids,

    // g is the pixel framebuffer (see render/pixel.js); world units / 3 = pixels.
    draw(g) {
      const P = (v) => Math.round(v / 3);
      const ground = P(base);
      // Always black: no highlight or warning, the timing is on you.
      const bar = PAL.ink;
      for (const wx of [x + 22, x2 - 22]) {
        const px = P(wx);
        g.line(px, P(yAt(wx)) + 2, px, ground - 1, PAL.ink);
        g.line(px - 2, ground - 1, px + 2, ground - 1, PAL.ink);
      }
      const n = arc ? 24 : 1;
      for (let i = 0; i < n; i++) {
        const [ax, bx] = [x + (length * i) / n, x + (length * (i + 1)) / n];
        g.line(P(ax), P(yAt(ax)), P(bx), P(yAt(bx)), bar);
        g.line(P(ax), P(yAt(ax)) + 1, P(bx), P(yAt(bx)) + 1, bar);
      }
    },
  };
}
