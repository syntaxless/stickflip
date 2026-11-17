import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';
import { box } from './box.js';

// A street trash can: a box to ollie over (its sides slam you, and the lid is
// no place to land). Drawn as chunky shaded pixel art: a black outline, a grey
// body with a lighter panel lit from the left, dark slots with a glint beside
// each, and a flat lid with a handle.
export function trashCan({ x, w = 66, h = 102, base = WORLD.GROUND }) {
  const can = box({ x, w, h, base });
  return {
    ...can,
    type: 'trash-can',
    draw(g) {
      const P = (v) => Math.round(v / 3);
      const [l, t, r, b] = [P(x), P(base - h), P(x + w) - 1, P(base) - 1];
      const { ink, steel, shine, wheel: white } = PAL;
      const mid = Math.round((l + r) / 2);

      // Handle: a little hoop on top of the lid.
      g.line(mid - 4, t, mid + 3, t, ink);
      g.line(mid - 4, t + 1, mid + 3, t + 1, steel);
      g.line(mid - 3, t + 1, mid, t + 1, shine);
      g.pset(mid - 4, t + 1, ink);
      g.pset(mid + 3, t + 1, ink);
      g.pset(mid - 4, t + 2, ink);
      g.pset(mid + 3, t + 2, ink);

      // Lid: overhangs the body a pixel each side, light on the left.
      const [ll, lr] = [l, r];
      g.line(ll + 1, t + 3, lr - 1, t + 3, ink);
      for (const y of [t + 4, t + 5]) {
        g.line(ll, y, lr, y, steel);
        g.line(ll + 1, y, ll + Math.round((lr - ll) * 0.6), y, shine);
        g.line(ll + 1, y, ll + 3, y, white);
        g.pset(ll, y, ink);
        g.pset(lr, y, ink);
      }
      g.line(ll + 1, t + 6, lr - 1, t + 6, ink);

      // Body: tapers in a pixel toward the bottom.
      const top = t + 7;
      const inset = (y) => (y > top + (b - top) * 0.6 ? 3 : 2);
      for (let y = top; y <= b; y++) {
        const i = inset(y);
        g.line(l + i, y, r - i, y, steel);
        g.pset(l + i, y, ink);
        g.pset(r - i, y, ink);
      }
      g.line(l + 3, b, r - 3, b, ink);

      // The lit panel, with a notch out of its bottom-left corner.
      const [pl, pr, pt, pb] = [l + 4, l + Math.round((r - l) * 0.7), top + 2, b - 3];
      g.fill(pl, pt, pr - pl + 1, pb - pt + 1, shine);
      g.pset(pl, pb, steel);

      // Slots: dark, two pixels wide, with a white glint down the right of
      // each one in the light, and a last one in the shade.
      const [st, sb] = [pt + 2, pb - 3];
      let sx = pl + 2;
      for (; sx + 2 <= pr; sx += 4) {
        g.fill(sx, st, 2, sb - st + 1, ink);
        g.line(sx + 2, st + 1, sx + 2, sb - 1, white);
      }
      if (sx + 1 < r - 3) g.fill(sx, st, 2, sb - st + 1, ink);
    },
  };
}
