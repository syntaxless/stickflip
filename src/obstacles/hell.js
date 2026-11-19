import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';
import { box } from './box.js';
import { gap } from './gap.js';
import { rail } from './rail.js';

// Hellride's own pieces: a lava pit, a ring of fire, a basalt barricade and the
// finish arch. Chunky shaded pixel art in the same style as the rest: black
// outline, a lit edge, a darker foot.
const P = (v) => Math.round(v / 3);
const G = WORLD.GROUND;
const { ink } = PAL;

const LAVA = { deep: [120, 16, 10], mid: [214, 56, 14], hot: [255, 140, 20], white: [255, 232, 120] };
const ROCK = { body: [58, 34, 44], lit: [124, 70, 70], dark: [30, 16, 24], crack: [255, 120, 30] };
const FIRE = [[255, 240, 140], [255, 190, 40], [255, 110, 20], [200, 40, 20]];

const hash = (a, b) => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
};

// A pit of lava where the street should be. Come up short and you drop in with
// a splash of embers (a gap bail). Same rules as any gap; it just looks worse.
export function lavaPit({ x, width }) {
  const hole = gap({ x, width });
  return {
    ...hole,
    type: 'lava',
    splash: { x1: x, x2: x + width, y: G, kind: 'lava' },
    draw(g, fx = {}) {
      const [l, r] = [P(x), P(x + width) - 1];
      const top = P(G) - 1;
      const t = fx.time || 0;
      g.fill(l, top, r - l + 1, 90, LAVA.deep); // a pool as deep as the water; the black ground below it is drawn by the background
      g.fill(l, top, r - l + 1, 12, LAVA.mid);
      for (let px = l; px <= r; px++) {
        const wave = Math.floor(Math.sin(px * 0.35 + t * 3) * 1.2 + 1.2);
        g.pset(px, top + wave, LAVA.hot);
        if (wave === 0) g.pset(px, top, LAVA.white);
        // slow bubbles rising through the glow
        const h = hash(px >> 1, 7);
        if (h % 9 === 0) {
          const ph = (t * 0.8 + (h % 100) / 100) % 1;
          g.pset(px, top + 11 - Math.round(ph * 11), ph > 0.8 ? LAVA.white : LAVA.hot);
        }
      }
      for (let px = l; px <= r; px += 5) g.pset(px + (hash(px, 3) % 3), top + 5 + (hash(px, 9) % 6), LAVA.hot);
      g.line(l - 1, top, l - 1, top + 90, ink);
      g.line(r + 1, top, r + 1, top + 90, ink);
      // a glow on the rock at either lip
      for (const px of [l - 2, r + 2]) g.pset(px, top, LAVA.hot);
    },
  };
}

// A ring of fire hanging in the air. Head above the top of the opening and you
// hit the flames; through it you get a bonus (and a turbo kick); below it and you
// pass under (a rider standing on the street does). See Game.passHazards.
export function fireRing({ x, top, bottom, name = 'FIRE RING', points = 300 }) {
  const hazard = { x, top: G - top, bottom: G - bottom, reason: 'fire', trick: name, points };
  return {
    type: 'fire-ring',
    surfaces: [],
    solids: [],
    hazards: [hazard],
    draw(g, fx = {}) {
      const cx = P(x);
      const [t, b] = [P(hazard.top), P(hazard.bottom)];
      const mid = (t + b) / 2;
      const ry = (b - t) / 2;
      const rx = 5;
      const time = fx.time || 0;
      // the hoop: a tall ellipse of flame, seen at an angle; the flames lick up and flicker
      for (let a = 0; a < 64; a++) {
        const th = (a / 64) * Math.PI * 2;
        const px = cx + Math.round(Math.cos(th) * rx);
        const py = Math.round(mid + Math.sin(th) * ry);
        const lick = (hash(a, Math.floor(time * 9)) % 3) + (Math.sin(th) < -0.5 ? 2 : 0); // taller at the top
        g.pset(px, py, ink);
        for (let k = 0; k <= lick; k++) g.pset(px + (k % 2 ? 1 : 0), py - k, FIRE[Math.min(3, 1 + (k >> 1))]);
        g.pset(px, py, FIRE[1 + (a % 2)]);
        g.pset(px - 1, py, ink);
      }
      for (let a = 0; a < 64; a += 2) {
        const th = (a / 64) * Math.PI * 2;
        g.pset(cx + Math.round(Math.cos(th) * (rx - 1)), Math.round(mid + Math.sin(th) * (ry - 1)), FIRE[0]);
      }
    },
  };
}

// A basalt barricade (an imp's hurdle): a block of black rock with glowing
// cracks. Ollie over it; its flat top can be ground like a rail.
export function barricade({ x, w = 60, h = 40 }) {
  const block = box({ x, w, h, grindable: true });
  return {
    ...block,
    type: 'barricade',
    draw(g, fx = {}) {
      const [l, t, r, b] = [P(x), P(G - h), P(x + w) - 1, P(G) - 1];
      g.fill(l, t, r - l + 1, b - t + 1, ROCK.body);
      for (let py = t; py <= b; py++) for (let px = l; px <= r; px++) if (hash(px >> 1, py >> 1) % 7 === 0) g.pset(px, py, ROCK.dark);
      g.rect(l, t, r - l + 1, b - t + 1, ink);
      g.line(l + 1, t + 1, r - 1, t + 1, ROCK.lit); // the lit top edge you grind along
      g.line(l + 1, t + 2, l + Math.round((r - l) * 0.55), t + 2, ROCK.lit);
      g.line(l + 1, b - 1, r - 1, b - 1, ROCK.dark);
      // glowing cracks that breathe
      const glow = Math.floor((fx.time || 0) * 2 + x) % 2;
      for (const [fx0, fy0, len] of [[0.25, 0.3, 5], [0.62, 0.45, 4], [0.45, 0.7, 3]]) {
        const cxp = l + Math.round((r - l) * fx0);
        const cyp = t + Math.round((b - t) * fy0);
        for (let i = 0; i < len; i++) g.pset(cxp + (i % 2), cyp + i, i === 1 && glow ? FIRE[0] : ROCK.crack);
      }
    },
  };
}

// The finish: a gate with a chequered banner across it, high enough to ride
// under (or fly through). Scenery only; crossing its x ends the race.
export function finishArch({ x, height = 330 }) {
  return {
    type: 'finish',
    surfaces: [],
    solids: [],
    draw(g, fx = {}) {
      const cx = P(x);
      const top = P(G - height);
      const ground = P(G) - 1;
      const reach = 22; // half the span, in pixels
      for (const px of [cx - reach, cx + reach]) {
        g.fill(px - 1, top, 3, ground - top, ink);
        g.fill(px, top + 1, 1, ground - top - 1, [210, 210, 214]);
      }
      // the banner: black and white squares, waving a pixel
      const w = reach * 2 - 2;
      const t = Math.floor((fx.time || 0) * 3);
      for (let i = 0; i < w; i++) {
        const wave = Math.round(Math.sin((i + t) * 0.5));
        for (let j = 0; j < 8; j++) {
          const black = (Math.floor(i / 4) + Math.floor(j / 4)) % 2 === 0;
          g.pset(cx - reach + 1 + i, top + j + wave, black ? ink : [250, 250, 250]);
        }
        g.pset(cx - reach + 1 + i, top - 1 + wave, ink);
        g.pset(cx - reach + 1 + i, top + 8 + wave, ink);
      }
      g.text('FINISH', cx + 1, top + 12, ink, 1, 'center');
      g.text('FINISH', cx, top + 11, [250, 250, 250], 1, 'center');
      // a painted line across the street
      g.fill(cx - 1, ground - 1, 3, 3, [250, 250, 250]);
    },
  };
}

// A rail hung over a pit: no posts to slam into, and you pass it (flying over, or
// under) unless you tap to lock a grind, like a stair set's handrail. It ends where it
// ends, so a grind drops you off past the pit.
export function bridgeRail({ x, length, height, arc = 0 }) {
  const r = rail({ x, length, height, arc });
  r.surfaces[0].passable = true;
  r.solids = [];
  return { ...r, type: 'bridge-rail' };
}
