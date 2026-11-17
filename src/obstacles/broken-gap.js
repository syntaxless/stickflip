import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';
import { gap } from './gap.js';

// A gap where the sidewalk has broken away: the renderer fills the hole with
// rubble (the `dirt` region, kind 'rubble'), and this draws the broken slab
// edges, tilted chunks of concrete and bits of rebar sticking up.
// Physics are those of a plain gap.
const P = (v) => Math.round(v / 3);
const CHUNK = [196, 196, 200];
const CHUNK_SHADE = [140, 140, 148];

export function brokenGap({ x, width }) {
  return {
    ...gap({ x, width }),
    type: 'broken-gap',
    dirt: { x1: x, x2: x + width, kind: 'rubble' },
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
      // rebar: a few bent rusty rods poking out of the rubble
      const REBAR = [160, 84, 40];
      for (const [px, h, lean] of [[l + 22, 6, 1], [l + 41, 8, -1], [r - 16, 5, 1], [r - 34, 7, -1]]) {
        for (let i = 0; i < h; i++) g.pset(px + Math.round((i * lean) / 3), street + 3 - i + 2, i % 3 === 2 ? ink : REBAR);
      }
      for (const [px, py] of [[l + 30, 7], [l + 52, 10], [r - 8, 6]]) {
        g.pset(px, street + py, CHUNK);
        g.pset(px + 1, street + py, CHUNK_SHADE);
        g.pset(px, street + py + 1, ink);
      }
    },
  };
}

// A broken piece of sidewalk tilted up out of the street: a slab ramp from the
// street at x up to `rise` high at x + run. Poured concrete underneath (the
// ground says material 'concrete'); this paints cracks, a chipped lip, rebar
// sticking out of the broken end and a few bits of debris. A free ride.
export function brokenSlab({ x, run, rise }) {
  const G = WORLD.GROUND;
  return {
    type: 'broken-slab',
    surfaces: [],
    solids: [],
    ground: [{ x1: x, x2: x + run, y1: G, y2: G - rise, landable: true, material: 'concrete' }],
    draw(g) {
      const { ink, crack } = PAL;
      const [l, r] = [P(x), P(x + run) - 1];
      const street = P(G);
      const topAt = (px) => P(G - (rise * (px * 3 - x)) / run);
      // shade the slab so it reads against a pale sky: darker toward the foot, with a seam under the lit top
      for (let px = l; px <= r; px++) {
        const t = topAt(px);
        for (let y = t + 3; y < street - 1; y++) if ((y - t > 7 && (px + y) % 2 === 0) || (y - t > 14 && (px + y) % 3 === 0)) g.pset(px, y, CHUNK_SHADE);
        const wob = ((px * 7) % 5) - 2;
        g.pset(px, t + 4 + (wob > 1 ? 1 : 0), CHUNK_SHADE);
      }
      const crackFrom = (px, len, lean) => {
        let cx = px;
        for (let i = 0; i < len; i++) {
          if (topAt(cx) + 2 + i < street - 1) g.pset(cx, topAt(cx) + 2 + i, ink);
          if (i % 3 === 2) cx += lean;
        }
      };
      crackFrom(l + 12, 12, 1);
      crackFrom(l + 22, 8, -1);
      crackFrom(l + 33, 14, 1);
      crackFrom(r - 10, 9, -1);
      // a chipped corner at the lip: a notch of shadow, and rebar poking out of the broken end
      const lt = topAt(r);
      g.fill(r - 3, lt + 1, 4, 3, CHUNK_SHADE);
      g.line(r - 3, lt + 1, r, lt + 1, ink);
      const REBAR = [160, 84, 40];
      for (const [dx, h, lean] of [[-6, 6, -1], [-2, 8, 1], [-9, 4, -1]]) {
        const px = r + dx;
        for (let i = 0; i < h; i++) g.pset(px + Math.round((i * lean) / 3), topAt(px) - 1 - i, i % 3 === 2 ? ink : REBAR);
      }
      // debris along the foot and on the ramp: chunks of broken concrete
      const chunk = (px, py, w, h) => {
        g.fill(px, py, w, h, CHUNK);
        g.line(px, py + h, px + w - 1, py + h, ink);
        g.line(px + w, py, px + w, py + h, ink);
        g.line(px, py, px + w - 1, py, [226, 226, 230]);
      };
      chunk(l - 6, street - 3, 4, 2);
      chunk(l - 14, street - 2, 3, 1);
      chunk(l + 5, topAt(l + 5) - 2, 3, 2);
      chunk(l + 26, topAt(l + 26) - 3, 4, 2);
      g.pset(l + 18, topAt(l + 18) - 1, crack);
    },
  };
}
