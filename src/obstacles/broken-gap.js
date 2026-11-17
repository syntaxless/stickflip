import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';
import { gap } from './gap.js';

// A gap where the sidewalk has broken away over bare dirt: the renderer fills
// the hole with sunken dirt (the `dirt` region, like dirtGap), and this draws
// the broken slab edges, tilted chunks of concrete and a few rubble bits.
// Physics are those of a plain gap.
const P = (v) => Math.round(v / 3);
const CHUNK = [196, 196, 200];
const CHUNK_SHADE = [140, 140, 148];

export function brokenGap({ x, width }) {
  return {
    ...gap({ x, width }),
    type: 'broken-gap',
    dirt: { x1: x, x2: x + width },
    draw(g) {
      const { ink, crack } = PAL;
      const [l, r] = [P(x), P(x + width) - 1];
      const street = P(WORLD.GROUND);
      // jagged broken lips: slab edges crumbling into the hole, a few pixels each
      const bite = (px, dir, rows) => {
        rows.forEach((n, i) => {
          const y = street + i;
          for (let k = 0; k < n; k++) g.pset(px + dir * k, y, k === n - 1 ? ink : i === 0 ? CHUNK : CHUNK_SHADE);
        });
      };
      bite(l, 1, [3, 2, 1]);
      bite(r, -1, [2, 3, 1]);
      // a slab fallen in, tilted, and a smaller piece
      const slab = (sx, sy, w, tilt) => {
        for (let i = 0; i < w; i++) {
          const y = sy + Math.round((i * tilt) / w);
          g.fill(sx + i, y, 1, 3, i < 2 ? CHUNK : CHUNK_SHADE);
          g.pset(sx + i, y, ink);
          g.pset(sx + i, y + 3, ink);
        }
        g.line(sx, sy, sx, sy + 3, ink);
        g.line(sx + w - 1, sy + Math.round(((w - 1) * tilt) / w), sx + w - 1, sy + 3 + Math.round(((w - 1) * tilt) / w), ink);
      };
      slab(l + 8, street + 6, 16, 4);
      slab(r - 26, street + 8, 12, -3);
      // cracks and rubble in the dirt
      for (let px = l + 3; px < r - 2; px += 9) {
        const dy = (px * 13) % 5;
        g.pset(px, street + 4 + dy, crack);
        g.pset(px + 1, street + 5 + dy, CHUNK_SHADE);
      }
      for (const [px, py] of [[l + 30, 7], [l + 52, 10], [r - 8, 6]]) {
        g.pset(px, street + py, CHUNK);
        g.pset(px + 1, street + py, CHUNK_SHADE);
        g.pset(px, street + py + 1, ink);
      }
    },
  };
}
