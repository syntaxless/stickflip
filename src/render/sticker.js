import { PAL, glyph } from './pixel.js';

// A black rectangle sticker with white lettering and a white inner border, turned to
// an angle as if someone slapped it on the screen: rough, nicked edges and a peeled
// bottom-right corner. Drawn pixel by pixel (each screen pixel is mapped back into
// the sticker's own grid), so it keeps the chunky look at any angle. Deterministic.

const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 997;
const FLAP = [200, 200, 200];
const FLAP_EDGE = [96, 96, 96];

export function drawSticker(g, cx, cy, text, { w = 76, h = 28, ang = -0.2, scale = 2, peel = 9, inset = 2 } = {}) {
  const co = Math.cos(ang);
  const si = Math.sin(ang);
  const tw = text.length * 6 * scale - scale;
  const th = 7 * scale;
  const reach = Math.ceil(Math.hypot(w, h) / 2) + 1;
  for (let py = cy - reach; py <= cy + reach; py++) {
    for (let px = cx - reach; px <= cx + reach; px++) {
      // back into the sticker's own axes
      const dx = px - cx;
      const dy = py - cy;
      const u = co * dx + si * dy;
      const v = -si * dx + co * dy;
      const edge = Math.min(w / 2 - Math.abs(u), h / 2 - Math.abs(v)); // distance in from the nearest side
      if (edge < 0) continue;
      const du = u - (w / 2 - peel);
      const dv = v - (h / 2 - peel);
      if (du > 0 && dv > 0 && du + dv > peel) continue; // the peeled corner has come away
      if (edge < 1.2 && hash(px, py) % 4 === 0) continue; // rough, nicked edge
      let c = PAL.ink;
      if (edge >= inset && edge < inset + 1.2) c = [255, 255, 255]; // the white inner border
      const tx = Math.floor((u + tw / 2) / scale);
      const ty = Math.floor((v + th / 2) / scale);
      if (tx >= 0 && ty >= 0 && tx < text.length * 6 - 1 && ty < 7) {
        const gl = glyph(text[Math.floor(tx / 6)]);
        const col = tx % 6;
        if (col < 5 && gl[ty] & (1 << (4 - col))) c = [255, 255, 255];
      }
      if (du > 0 && dv > 0 && du + dv > peel - 1.5 && du + dv <= peel) c = FLAP_EDGE; // the fold
      else if (du >= 0 && dv >= 0 && du + dv < peel - 1.5) c = FLAP; // the back of the folded corner
      g.pset(px, py, c);
    }
  }
}

// Where the LOSER sticker goes: stuck on the end of the SUCKS TO SUCK line, overlapping its
// bottom-right corner, as if someone had added it to the sentence. `cx` is the screen centre.
export const SUCKS_TEXT = { y: 64, width: 77 }; // the line's top and width (13 characters at scale 1)
export function loserSpot(cx) {
  return {
    x: Math.round(cx + SUCKS_TEXT.width / 2 + 19),
    y: SUCKS_TEXT.y + 6,
    opts: { w: 37, h: 15, ang: -0.14, scale: 1, peel: 4, inset: 1.5 },
  };
}
