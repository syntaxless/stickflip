import { PAL } from './pixel.js';

// Shared chunky shaded-metal pieces (black outline, grey body, silver lit
// edge, white glints), so every obstacle matches the trash can. Purely
// cosmetic: none of this changes an obstacle's physics shape.

// A pipe/bar from (x1, y1) to (x2, y2) in pixels: silver lit top row, grey
// body row, black underside, and a white glint every so often.
export function pipe(g, x1, y1, x2, y2) {
  const { ink, steel, shine, wheel } = PAL;
  g.line(x1, y1, x2, y2, shine);
  g.line(x1, y1 + 1, x2, y2 + 1, steel);
  g.line(x1, y1 + 2, x2, y2 + 2, ink);
  const n = Math.abs(x2 - x1);
  const dir = x2 >= x1 ? 1 : -1;
  for (let i = 5; i < n - 3; i += 22) {
    const px = x1 + i * dir;
    g.pset(px, Math.round(y1 + ((y2 - y1) * i) / (n || 1)), wheel);
  }
}

// A post from y1 down to the ground row y2 at pixel x: black outline either
// side of a grey shaft with a silver lit side, and a little foot plate.
export function post(g, x, y1, y2) {
  const { ink, steel, shine } = PAL;
  g.line(x - 1, y1, x - 1, y2, ink);
  g.line(x + 1, y1, x + 1, y2, ink);
  g.line(x, y1, x, y2, steel);
  g.line(x - 1, y1 + 1, x - 1, y2 - 1, shine); // lit side overwrites the left outline
  g.line(x - 3, y2, x + 3, y2, ink);
  g.line(x - 2, y2 - 1, x + 2, y2 - 1, steel);
}
