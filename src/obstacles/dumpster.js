import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';
import { box } from './box.js';
const P = (v) => Math.round(v / 3);
const { ink, steel, shine, wheel: white } = PAL;
// A green street dumpster: ollie over it, land on its lid and roll off, or grind
// the lid's edge with a timed tap (like a rail). Its sides slam you.
export function dumpster({ x, w = 150, h = 96, base = WORLD.GROUND }) {
  const b0 = box({ x, w, h, landable: true, grindable: true, base });
  return { ...b0, type: 'dumpster', draw(g) {
    const [l, t, r, b] = [P(x), P(base - h), P(x + w) - 1, P(base) - 1];
    const G1 = [40, 120, 70], G0 = [70, 160, 95], G2 = [24, 80, 48];
    g.fill(l, t, r - l + 1, b - t + 1, G1);
    g.fill(l + 1, t + 1, r - l - 1, 3, G0);        // lit lid
    g.fill(l - 1, t - 3, r - l + 3, 4, G2);          // lid overhang
    g.line(l - 1, t - 3, r + 1, t - 3, shine);
    g.rect(l - 1, t - 3, r - l + 3, 5, ink);
    g.rect(l, t + 2, r - l + 1, b - t - 1, ink);
    for (let px = l + 10; px < r - 6; px += 14) g.line(px, t + 9, px, b - 3, G2); // ribs
    g.fill(l + 3, b - 3, 4, 3, ink); g.fill(r - 6, b - 3, 4, 3, ink);           // wheels
    g.fill(l + 14, t + 12, 20, 9, [230, 230, 235]); g.rect(l + 14, t + 12, 20, 9, ink); // sticker
    g.fill(l + 18, t + 15, 12, 2, [200, 40, 40]);
  } };
}
