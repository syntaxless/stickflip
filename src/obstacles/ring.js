import { PAL } from '../render/pixel.js';

// A ring of fire hanging high in the air at x. A small ollie passes under it
// with no modifier; a charged one puts your head through the opening for a
// trick (RING OF FIRE, with a bonus); too high and your head hits the top of
// the ring ('fire'). `top` and `bottom` are the inside of the ring.
export function ring({ x, top, bottom, points = 600 }) {
  const cy = (top + bottom) / 2;
  const ry = (bottom - top) / 2 + 6; // the flames sit just outside the opening
  const rx = 18;
  return {
    type: 'ring',
    surfaces: [],
    solids: [],
    hazards: [{ x, top, bottom, reason: 'fire', trick: 'RING OF FIRE', points }],
    draw(g, fx = {}) {
      const P = (v) => Math.round(v / 3);
      const t = fx.time || 0;
      const n = 96; // close enough together to draw a solid hoop, two pixels thick
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const px = P(x + Math.cos(a) * rx);
        const py = P(cy + Math.sin(a) * ry);
        g.pset(px, py, PAL.flame);
        g.pset(px + (Math.cos(a) < 0 ? -1 : 1), py, PAL.flame);
        g.pset(px, py - 1, PAL.flame);
        // flickering tongues of flame, licking upward
        const flick = Math.sin(t * 17 + i * 2.3) + Math.sin(t * 11 + i * 1.7);
        if (flick > 0.4) g.pset(px + (i % 2 ? 1 : -1), py - 2, PAL.fire);
        if (flick > 1.2) g.pset(px, py - 3, PAL.fire);
      }
    },
  };
}
