import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';
import { box } from './box.js';
import { gap } from './gap.js';
import { POOL_DEPTH } from './art.js';
import { rail } from './rail.js';

// Frostbite's own pieces (Stage 7): a snowman, ice blocks, a frozen pond with ice floes, a ski
// gate, a snowy cabin roof, a snow-capped rail and the summit flag. Chunky shaded pixel art in
// the same style as the rest: black outline, a lit edge, a darker foot.
const P = (v) => Math.round(v / 3);
const G = WORLD.GROUND;
const { ink } = PAL;

const SNOW = { white: [250, 252, 255], lit: [255, 255, 255], shade: [196, 212, 238], dark: [150, 172, 210] };
const ICE = { body: [150, 206, 242], lit: [222, 246, 255], dark: [84, 146, 204], deep: [52, 104, 176] };
const WATER = { deep: [14, 40, 96], mid: [30, 82, 156], light: [120, 190, 240] };
const LOG = { a: [150, 92, 50], b: [128, 74, 40], lit: [190, 126, 72], dark: [84, 48, 26] };

const hash = (a, b) => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
};

// A snowman: three balls of snow, a coal face, a carrot nose, a red scarf and a top hat.
// A solid hurdle (hit it and you slam): ollie over it.
export function snowman({ x, h = 69, w = 39 }) {
  const block = box({ x, w, h });
  return {
    ...block,
    type: 'snowman',
    draw(g) {
      const cx = P(x + w / 2);
      const b = P(G) - 1;
      const balls = [[b - 6, 6], [b - 14, 4], [b - 20, 3]]; // [centre y, radius]: belly, chest, head
      for (const [cy, r] of balls) g.circle(cx, cy, r + 1, ink, true);
      balls.forEach(([cy, r], i) => {
        g.circle(cx, cy, r, SNOW.white, true);
        // a shaded lower-right edge and a lit top-left glint
        for (let dy = 0; dy <= r; dy++) {
          const half = Math.round(Math.sqrt(r * r - dy * dy));
          g.pset(cx + half, cy + dy, SNOW.shade);
          if (dy > r * 0.4) g.pset(cx + half - 1, cy + dy, SNOW.shade);
        }
        g.pset(cx - Math.round(r * 0.5), cy - Math.round(r * 0.6), SNOW.lit);
        if (i === 0) g.line(cx - 3, cy + r - 1, cx + 3, cy + r - 1, SNOW.dark);
      });
      const [headY] = balls[2];
      g.pset(cx - 1, headY - 1, ink); // coal eyes
      g.pset(cx + 1, headY - 1, ink);
      g.line(cx, headY + 1, cx + 3, headY + 1, [255, 128, 0]); // carrot nose
      g.pset(cx + 3, headY + 1, [214, 80, 0]);
      for (let i = -2; i <= 2; i += 2) g.pset(cx + i, headY + 2 + (i === 0 ? 1 : 0), ink); // smile
      g.line(cx - 3, balls[1][0] - 3, cx + 3, balls[1][0] - 3, [214, 30, 40]); // scarf
      g.line(cx - 3, balls[1][0] - 2, cx - 3, balls[1][0], [214, 30, 40]);
      g.line(cx - 2, balls[1][0] - 3, cx - 4, balls[1][0] - 3, ink);
      g.fill(cx - 3, headY - 5, 7, 1, ink); // top hat brim
      g.fill(cx - 2, headY - 8, 5, 3, ink);
      g.line(cx - 2, headY - 6, cx + 2, headY - 6, [214, 30, 40]);
      g.line(cx - 6, balls[1][0] - 1, cx - 9, balls[1][0] - 4, LOG.dark); // stick arms
      g.line(cx + 6, balls[1][0] - 1, cx + 9, balls[1][0] - 4, LOG.dark);
      g.pset(cx - 9, balls[1][0] - 5, LOG.dark);
      g.pset(cx + 9, balls[1][0] - 5, LOG.dark);
    },
  };
}

// A block of ice: pale blue with a bright top edge you can grind (a low one can be slappied),
// diagonal glints and a darker foot.
export function iceBlock({ x, w = 60, h = 40 }) {
  const block = box({ x, w, h, grindable: true });
  return {
    ...block,
    type: 'ice-block',
    draw(g, fx = {}) {
      const [l, t, r, b] = [P(x), P(G - h), P(x + w) - 1, P(G) - 1];
      g.fill(l, t, r - l + 1, b - t + 1, ICE.body);
      for (let py = t; py <= b; py++) for (let px = l; px <= r; px++) if (hash(px >> 1, py >> 1) % 6 === 0) g.pset(px, py, ICE.dark);
      g.rect(l, t, r - l + 1, b - t + 1, ink);
      g.line(l + 1, t + 1, r - 1, t + 1, ICE.lit); // the lit top edge you grind along
      g.line(l + 1, t + 2, l + Math.round((r - l) * 0.6), t + 2, ICE.lit);
      g.line(l + 1, b - 1, r - 1, b - 1, ICE.deep);
      g.line(l + 1, b - 2, r - 1, b - 2, ICE.dark);
      // two diagonal glints, and a slow sparkle
      for (const f of [0.3, 0.68]) {
        const gx = l + Math.round((r - l) * f);
        for (let i = 0; i < Math.min(5, b - t - 5); i++) g.pset(gx - i, t + 4 + i, i % 2 ? ICE.lit : SNOW.white);
      }
      const sparkle = Math.floor(Math.max(0, fx.time || 0) * 2 + x) % 4;
      if (sparkle === 0) g.pset(l + 3, t + 3, SNOW.lit);
    },
  };
}

// A frozen pond where the street should be: dark open water under the ice, jagged ice at both lips.
// Come up short and you drop through (a gap bail, with a splash). `floes` are slabs of ice floating in
// it: land on one (they are low, flush with the street) and ollie off the far end. `deep` is a dark
// crevasse instead (blue-black, with icicles hanging from its lips).
export function icePond({ x, width, floes = [], deep = false }) {
  const hole = gap({ x, width });
  const floeSurfaces = floes.map((f) => ({ x1: x + f.x, x2: x + f.x + f.w, y: G, landable: true, grindable: false }));
  return {
    ...hole,
    type: 'ice-pond',
    surfaces: floeSurfaces,
    splash: { x1: x, x2: x + width, y: G, kind: 'water' },
    draw(g, fx = {}) {
      const [l, r] = [P(x), P(x + width) - 1];
      const top = P(G) - 1;
      const t = fx.time || 0;
      const [deepC, midC] = deep ? [[6, 14, 40], [14, 32, 78]] : [WATER.deep, WATER.mid];
      g.fill(l, top, r - l + 1, POOL_DEPTH, deepC);
      g.fill(l, top + 2, r - l + 1, 9, midC);
      for (let px = l; px <= r; px++) {
        const wave = Math.floor(Math.sin(px * 0.4 + t * 2.4) * 0.8 + 0.8);
        g.pset(px, top + 2 + wave, WATER.light);
        if (hash(px, 17) % 11 === 0) g.pset(px, top + 5 + (hash(px, 2) % 4), WATER.light);
      }
      g.line(l - 1, top, l - 1, top + POOL_DEPTH, ink);
      g.line(r + 1, top, r + 1, top + POOL_DEPTH, ink);
      // jagged ice at each lip: a white shelf over the water, and (deep) icicles hanging under it
      for (let i = 0; i < 5; i++) {
        const len = 2 + ((hash(i, x) >> 3) % 3);
        for (const [px, dir] of [[l + i, 1], [r - i, -1]]) {
          g.fill(px, top, 1, Math.max(1, 3 - (i >> 1)) + (deep ? len - 1 : 0), SNOW.white);
          if (deep && i % 2 === 0) g.pset(px, top + 3 + len, ICE.lit);
          void dir;
        }
      }
      // a few little chunks of ice bobbing on the surface
      for (let k = 0; k < Math.floor(width / 110); k++) {
        const cx = l + 12 + ((hash(k, x + 3) % Math.max(1, r - l - 24)));
        const bob = Math.round(Math.sin(t * 1.6 + k * 2));
        g.fill(cx, top + 1 + bob, 4, 2, SNOW.white);
        g.line(cx, top + 3 + bob, cx + 3, top + 3 + bob, ICE.dark);
      }
      // the floes: a flat slab of ice flush with the street, white top, blue sides, a shadow on the water
      for (const f of floes) {
        const [fl, fr] = [P(x + f.x), P(x + f.x + f.w) - 1];
        const bob = Math.round(Math.sin(t * 1.3 + f.x) * 0);
        g.fill(fl, top + bob, fr - fl + 1, 5, ICE.body);
        g.line(fl, top + bob, fr, top + bob, SNOW.white);
        g.line(fl, top + bob + 1, fr, top + bob + 1, ICE.lit);
        g.line(fl + 1, top + bob + 4, fr - 1, top + bob + 4, ICE.dark);
        g.line(fl, top + bob + 5, fr, top + bob + 5, ink);
        g.line(fl - 1, top + bob, fl - 1, top + bob + 5, ink);
        g.line(fr + 1, top + bob, fr + 1, top + bob + 5, ink);
        g.fill(fl + 2, top + bob + 6, fr - fl - 3, 1, deepC);
        g.pset(fl + 3, top + bob + 2, ICE.dark);
        g.pset(fr - 4, top + bob + 3, ICE.dark);
      }
    },
  };
}

// A slalom gate: two striped poles with a banner across the top. Pass under it, or jump through it
// (head inside the opening) for a bonus; head above the banner and you hit it. Same rules as a ring of
// fire (see Game.passHazards).
export function skiGate({ x, top, bottom, name = 'SLALOM GATE', points = 250 }) {
  const hazard = { x, top: G - top, bottom: G - bottom, reason: 'gate', trick: name, points };
  return {
    type: 'ski-gate',
    surfaces: [],
    solids: [],
    hazards: [hazard],
    draw(g, fx = {}) {
      const cx = P(x);
      const t = P(hazard.top);
      const ground = P(G) - 1;
      const reach = 4;
      for (const px of [cx - reach, cx + reach]) {
        for (let py = t; py <= ground; py++) {
          const stripe = Math.floor((py - t) / 3) % 2 === 0;
          g.pset(px - 1, py, ink);
          g.pset(px + 1, py, ink);
          g.pset(px, py, stripe ? [214, 30, 40] : SNOW.white);
        }
        g.line(px - 2, ground, px + 2, ground, ink);
        g.fill(px - 1, ground - 1, 3, 1, SNOW.white); // a little snow heaped at the foot
      }
      // the banner: a pennant strip waving a pixel between the pole tops
      const w = reach * 2 - 1;
      const wave = Math.floor(Math.max(0, fx.time || 0) * 3) % 2;
      g.fill(cx - reach + 1, t - 2 + wave, w, 4, [30, 80, 200]);
      g.rect(cx - reach, t - 3 + wave, w + 2, 6, ink);
      g.line(cx - reach + 1, t - 2 + wave, cx + reach - 1, t - 2 + wave, [120, 170, 255]);
      g.pset(cx - 1, t + wave, SNOW.white);
      g.pset(cx, t + wave, SNOW.white);
      g.pset(cx + 1, t + wave, SNOW.white);
    },
  };
}

// A cabin: a log wall with a snow-heavy flat roof. Ollie up onto the roof and ride along it (land), or lock a
// grind on its edge. Roll off the end and you drop back to the street.
export function cabin({ x, w = 240, h = 60 }) {
  const block = box({ x, w, h, landable: true, grindable: true });
  return {
    ...block,
    type: 'cabin',
    draw(g, fx = {}) {
      const [l, t, r, b] = [P(x), P(G - h), P(x + w) - 1, P(G) - 1];
      // logs: horizontal rows with darker seams and round ends at the corners
      for (let py = t + 3; py <= b; py++) {
        const row = Math.floor((py - t - 3) / 4) % 2;
        const seam = (py - t - 3) % 4 === 3;
        for (let px = l; px <= r; px++) g.pset(px, py, seam ? LOG.dark : (px + row * 3) % 9 < 4 ? LOG.a : LOG.b);
        if (!seam) g.pset(l + 1, py, LOG.lit);
      }
      for (let py = t + 5; py <= b; py += 4) { // log ends sticking out at the corners
        g.fill(l - 1, py, 2, 3, LOG.lit);
        g.fill(r, py, 2, 3, LOG.lit);
        g.pset(l - 1, py + 3, ink);
        g.pset(r + 1, py + 3, ink);
      }
      g.rect(l, t, r - l + 1, b - t + 1, ink);
      // a lit window with a cross bar, and a door with a handle, in warm light
      const wx = l + Math.round((r - l) * 0.28);
      g.fill(wx, t + 8, 12, 8, [255, 214, 100]);
      g.rect(wx - 1, t + 7, 14, 10, ink);
      g.line(wx + 6, t + 8, wx + 6, t + 15, ink);
      g.line(wx, t + 11, wx + 11, t + 11, ink);
      const flick = Math.floor(Math.max(0, fx.time || 0) * 3) % 2;
      g.pset(wx + 2 + flick, t + 9, [255, 246, 190]);
      const dx = l + Math.round((r - l) * 0.68);
      g.fill(dx, t + 6, 9, b - t - 5, LOG.dark);
      g.rect(dx - 1, t + 5, 11, b - t - 4, ink);
      g.pset(dx + 7, t + 14, [255, 214, 100]);
      // the roof: a thick white slab of snow, lumpy on top, lit edge you grind along, blue shadow under it
      g.fill(l - 2, t - 2, r - l + 5, 6, SNOW.white);
      g.rect(l - 2, t - 3, r - l + 5, 7, ink);
      g.line(l - 1, t - 2, r + 1, t - 2, SNOW.lit);
      g.line(l - 1, t + 2, r + 1, t + 2, SNOW.shade);
      for (let px = l; px <= r; px += 7) g.pset(px + (hash(px, 4) % 3), t - 3 - (hash(px, 5) % 2), SNOW.white);
      for (let px = l; px <= r; px += 5) { // little icicles under the eaves
        const len = 1 + (hash(px, 8) % 3);
        g.fill(px, t + 4, 1, len, ICE.lit);
      }
    },
  };
}

// A rail with snow heaped on its posts and a dusting along the bar (a rail you can still grind).
export function snowRail({ x, length, height, arc = 0 }) {
  const r = rail({ x, length, height, arc });
  return {
    ...r,
    type: 'snow-rail',
    draw(g, fx) {
      r.draw(g, fx);
      const base = P(G);
      for (const wx of [x + 22, x + length - 22]) {
        const px = P(wx);
        g.fill(px - 3, base - 3, 7, 2, SNOW.white); // a drift at the foot
        g.line(px - 2, base - 1, px + 2, base - 1, SNOW.shade);
      }
    },
  };
}

// The summit: a flag on a pole, planted in a cairn of rocks. Scenery only.
export function summitFlag({ x }) {
  return {
    type: 'summit',
    surfaces: [],
    solids: [],
    draw(g, fx = {}) {
      const cx = P(x);
      const ground = P(G) - 1;
      const top = ground - 40;
      for (let i = 0; i < 4; i++) {
        const w = 11 - i * 2;
        g.fill(cx - (w >> 1), ground - 3 - i * 3, w, 3, i % 2 ? [150, 160, 180] : [120, 132, 156]);
        g.rect(cx - (w >> 1) - 1, ground - 4 - i * 3, w + 2, 5, ink);
        g.fill(cx - (w >> 1), ground - 3 - i * 3, w, 1, SNOW.white);
      }
      g.line(cx, top, cx, ground - 12, ink);
      g.line(cx - 1, top, cx - 1, ground - 12, SNOW.white);
      g.circle(cx - 1, top - 1, 1, [255, 214, 90], true);
      const t = Math.floor(Math.max(0, fx.time || 0) * 3);
      for (let i = 0; i < 40; i++) {
        const wave = Math.round(Math.sin((i + t) * 0.5));
        for (let j = 0; j < 12; j++) g.pset(cx + i, top + 2 + j + wave, j === 0 || j === 11 || i === 39 ? ink : [214, 30, 40]);
        g.pset(cx + i, top + 3 + wave, [255, 120, 110]);
      }
      g.text('SUMMIT', cx + 21, top + 5, SNOW.white, 1, 'center');
    },
  };
}
