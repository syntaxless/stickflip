import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';
import { box } from './box.js';

// A street trash can: a box to ollie over (its sides slam you, and the lid is
// no place to land), drawn as an old ribbed metal can with a domed lid.
export function trashCan({ x, w = 54, h = 114, base = WORLD.GROUND }) {
  const can = box({ x, w, h, base });
  return {
    ...can,
    type: 'trash-can',
    draw(g) {
      const P = (v) => Math.round(v / 3);
      const [l, t, r, b] = [P(x), P(base - h), P(x + w) - 1, P(base) - 1];
      const lid = t + 3; // the rim of the lid: the body starts under it
      // The body tapers in a pixel each side toward the bottom.
      const inset = (y) => (y > lid + (b - lid) * 0.55 ? 2 : 1);
      for (let y = lid + 1; y <= b; y++) {
        const i = inset(y);
        g.line(l + i, y, r - i, y, PAL.ground);
        g.pset(l + i, y, PAL.edge);
        g.pset(r - i, y, PAL.edge);
      }
      g.line(l + 2, b, r - 2, b, PAL.edge);
      // Ribs down the body, and a band a third of the way down.
      for (let rx = l + 4; rx <= r - 4; rx += 3) g.line(rx, lid + 3, rx, b - 2, PAL.ink);
      const band = lid + Math.round((b - lid) * 0.3);
      g.line(l + 1, band, r - 1, band, PAL.edge);
      // Side handles.
      g.line(l - 1, band + 2, l - 1, band + 5, PAL.edge);
      g.line(r + 1, band + 2, r + 1, band + 5, PAL.edge);
      // The lid: a rim that overhangs, a low dome, and a handle on top.
      g.line(l - 1, lid, r + 1, lid, PAL.edge);
      g.line(l - 1, lid - 1, r + 1, lid - 1, PAL.edge);
      g.line(l + 1, lid - 2, r - 1, lid - 2, PAL.ground);
      g.line(l + 1, lid - 3, r - 1, lid - 3, PAL.edge);
      g.pset(l, lid - 2, PAL.edge);
      g.pset(r, lid - 2, PAL.edge);
      const mid = Math.round((l + r) / 2);
      g.line(mid - 1, lid - 4, mid + 1, lid - 4, PAL.edge);
    },
  };
}
