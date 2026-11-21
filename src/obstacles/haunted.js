import { box } from './box.js';
import { rail } from './rail.js';
import { P, G, ink, hash, gate, pit, POOL_DEPTH } from './art.js';

// Haunted Night's own pieces (Stage 10): gravestones, a grave mound, a coffin kicker, an iron fence rail,
// an open grave with a coffin lid floating in it, pumpkins, a standing coffin, lantern gates, a mausoleum
// and the mansion at the end. Chunky shaded pixel art like the rest: black outline, a lit edge, a darker foot.
const STONE = { body: [150, 146, 164], lit: [206, 202, 220], dark: [92, 88, 108], moss: [84, 130, 84] };
const WOOD = { a: [124, 82, 60], b: [96, 62, 46], lit: [168, 114, 82], dark: [58, 36, 30] };
const IRON = { body: [60, 58, 76], lit: [128, 124, 150], dark: [28, 26, 40] };
const PUMPKIN = { body: [244, 130, 30], lit: [255, 190, 90], dark: [176, 76, 14], stem: [70, 120, 50] };
const GLOW = [[255, 240, 150], [255, 200, 90], [214, 140, 60]];
const MIST = [120, 255, 170];

// A gravestone: rounded, a cross or a tall obelisk. A solid hurdle; the top is grindable (a low one can be slappied).
export function gravestone({ x, w = 40, h = 40, kind = 'round' }) {
  const block = box({ x, w, h, grindable: true });
  return {
    ...block,
    type: `gravestone-${kind}`,
    draw(g) {
      const [l, t, r, b] = [P(x), P(G - h), P(x + w) - 1, P(G) - 1];
      const cx = (l + r) >> 1;
      if (kind === 'cross') {
        // a stone cross on a plinth
        const arm = Math.round((r - l) * 0.5);
        g.fill(cx - 2, t, 5, b - t - 4, STONE.body);
        g.fill(cx - arm, t + 5, arm * 2 + 1, 4, STONE.body);
        g.rect(cx - 3, t - 1, 7, b - t - 3, ink);
        g.rect(cx - arm - 1, t + 4, arm * 2 + 3, 6, ink);
        g.fill(cx - 2, t, 5, b - t - 4, STONE.body);
        g.fill(cx - arm, t + 5, arm * 2 + 1, 4, STONE.body);
        g.line(cx - 2, t, cx - 2, b - 6, STONE.lit);
        g.line(cx - arm, t + 5, cx + arm, t + 5, STONE.lit);
        g.fill(l, b - 4, r - l + 1, 5, STONE.dark);
        g.rect(l, b - 5, r - l + 1, 6, ink);
        g.fill(l + 1, b - 4, r - l - 1, 3, STONE.body);
        return;
      }
      if (kind === 'obelisk') {
        for (let py = t; py <= b; py++) {
          const k = (py - t) / (b - t);
          const half = Math.round((r - l) * (0.2 + 0.3 * Math.min(1, k * 1.4)) / 2);
          g.fill(cx - half, py, half * 2 + 1, 1, STONE.body);
          g.pset(cx - half - 1, py, ink);
          g.pset(cx + half + 1, py, ink);
          g.pset(cx - half, py, STONE.lit);
          g.pset(cx + half, py, STONE.dark);
        }
        g.fill(cx - 1, t - 1, 3, 1, ink);
        g.fill(l, b - 3, r - l + 1, 4, STONE.dark);
        g.rect(l, b - 4, r - l + 1, 5, ink);
        g.fill(l + 1, b - 3, r - l - 1, 2, STONE.body);
        for (let py = t + 8; py < b - 6; py += 5) g.pset(cx, py, STONE.dark); // carved lines
        return;
      }
      // rounded headstone: a slab with a small arched top on a low base, a carved cross inside (no lettering
      // to run off the edge of a narrow stone)
      const baseH = 2;
      const ARCH = [3, 2, 1, 1, 0]; // how far in each of the top rows sits
      const half = (r - l) / 2;
      let prev = ARCH[0];
      for (let py = t; py <= b - baseH; py++) {
        const inset = Math.min(ARCH[py - t] ?? 0, Math.floor(half) - 2);
        g.fill(l + inset, py, r - l + 1 - inset * 2, 1, STONE.body);
        for (let o = Math.min(inset, prev); o <= Math.max(inset, prev); o++) { g.pset(l + o - 1, py, ink); g.pset(r - o + 1, py, ink); }
        g.pset(l + inset, py, STONE.lit);
        if (py - t > 1) g.pset(l + inset + 1, py, STONE.lit);
        g.pset(r - inset, py, STONE.dark);
        if (py - t > 1) g.pset(r - inset - 1, py, STONE.dark);
        prev = inset;
      }
      g.line(l + ARCH[0], t - 1, r - ARCH[0], t - 1, ink);
      g.line(l + ARCH[0] + 1, t, r - ARCH[0] - 1, t, STONE.lit);
      // the carved cross, in the upper half of the slab
      const cy = t + 4;
      g.fill(cx, cy, 1, 5, STONE.dark);
      g.fill(cx - 1, cy + 1, 3, 1, STONE.dark);
      // the base: one pixel wider each side, a darker foot
      g.fill(l - 1, b - baseH + 1, r - l + 3, baseH, STONE.dark);
      g.line(l - 1, b - baseH + 1, r + 1, b - baseH + 1, STONE.body);
      g.rect(l - 2, b - baseH, r - l + 5, baseH + 1, ink);
      g.line(l - 1, b - baseH + 1, r + 1, b - baseH + 1, STONE.body);
      for (let px = l + 1; px < r; px += 4) g.pset(px, b - baseH - 1, STONE.moss); // a little moss at the foot
    },
  };
}

// A fresh grave mound: the street rises to a soft crest and falls away, heaped with dark earth and a
// few wilted flowers. Roll over it, or pop its crest.
export function graveMound({ x, run = 90, h = 28 }) {
  const up = { x1: x, x2: x + run, y1: G, y2: G - h, landable: true };
  const down = { x1: x + run, x2: x + 2 * run, y1: G - h, y2: G, landable: true };
  return {
    type: 'grave-mound',
    surfaces: [],
    solids: [],
    ground: [up, down],
    draw(g) {
      for (let px = P(x); px < P(x + 2 * run); px++) {
        const wx = px * 3 + 1;
        const k = wx < x + run ? (wx - x) / run : 1 - (wx - x - run) / run;
        const top = P(G - h * k);
        for (let py = top; py <= P(G) - 1; py++) {
          const hb = hash(px >> 1, py >> 1) % 8;
          g.pset(px, py, py === top ? [112, 82, 80] : hb === 0 ? [46, 32, 40] : hb === 1 ? [98, 70, 70] : [74, 52, 58]);
        }
        if (k > 0.05) g.pset(px, top - 1, ink);
      }
      const cx = P(x + run);
      const top = P(G - h);
      for (const [dx, c] of [[-4, [230, 90, 120]], [0, [250, 230, 120]], [4, [200, 140, 240]]]) {
        g.line(cx + dx, top - 1, cx + dx, top - 4, [60, 100, 60]);
        g.pset(cx + dx, top - 5, c);
      }
    },
  };
}

// A wrought-iron fence laid on its side as a rail: pickets with spear tips under a grindable bar.
export function fenceRail({ x, length, height, arc = 0 }) {
  const r = rail({ x, length, height, arc });
  return {
    ...r,
    type: 'fence-rail',
    draw(g, fx) {
      r.draw(g, fx);
      const [l, rr] = [P(x), P(x + length) - 1];
      const yAt = (px) => Math.round(P(G - height) - (arc ? (arc / 3) * 4 * ((px - l) / (rr - l)) * (1 - (px - l) / (rr - l)) : 0));
      for (let px = l + 4; px < rr - 2; px += 4) {
        const y = yAt(px);
        g.line(px, y + 2, px, y + 9, IRON.body);
        g.pset(px, y + 1, IRON.lit);
        g.pset(px, y - 2, IRON.lit); // the spear tip, above the bar
        g.pset(px, y - 1, IRON.body);
      }
    },
  };
}

// An open grave where the street should be: a dark pit with a green ghost-light glow and drifting mist.
// Come up short and you drop in (a gap bail). `floes` are coffin lids lying flush with the street.
export function openGrave({ x, width, floes = [], deep = false }) {
  return pit({
    type: 'open-grave',
    x,
    width,
    floes,
    kind: 'water',
    paint(g, fx, { l, r, top }) {
      const t = fx.time || 0;
      const [c1, c2] = deep ? [[10, 8, 24], [26, 20, 54]] : [[16, 12, 32], [40, 30, 64]];
      g.fill(l, top, r - l + 1, POOL_DEPTH, c1);
      g.fill(l, top + 2, r - l + 1, 9, c2);
      for (let px = l; px <= r; px++) {
        const wave = Math.floor(Math.sin(px * 0.3 + t * 1.6) * 0.9 + 0.9);
        if (hash(px, 5) % 4 === 0) g.pset(px, top + 2 + wave, [90, 200, 130]);
        if (hash(px, 29) % 15 === 0) g.pset(px, top + 5 + ((t * 6 + px) % 6), MIST); // wisps rising
      }
      for (const px of [l - 1, r + 1]) g.line(px, top, px, top + POOL_DEPTH, ink);
      // raw earth at the lips, with roots
      for (let i = 0; i < 5; i++) for (const px of [l + i, r - i]) g.fill(px, top, 1, Math.max(1, 3 - (i >> 1)), [74, 52, 58]);
      for (const px of [l + 3, r - 3]) g.line(px, top + 3, px, top + 7, [112, 82, 80]);
      // mist drifting over the pit
      for (let i = 0; i < 4; i++) {
        const mx = l + ((i * 37 + Math.round(t * 5)) % Math.max(1, r - l));
        g.fill(mx, top - 2 + (i % 2), 9, 1, [156, 150, 186]);
      }
    },
    paintFloe(g, fx, { l, r, top }) {
      // a coffin lid: a hexagon-ish slab with a cross, flush with the street
      g.fill(l, top, r - l + 1, 5, WOOD.a);
      g.line(l, top, r, top, WOOD.lit);
      g.line(l + 1, top + 1, r - 1, top + 1, WOOD.lit);
      g.line(l + 1, top + 4, r - 1, top + 4, WOOD.dark);
      g.line(l, top + 5, r, top + 5, ink);
      g.line(l - 1, top, l - 1, top + 5, ink);
      g.line(r + 1, top, r + 1, top + 5, ink);
      const cx = (l + r) >> 1;
      g.line(cx - 3, top + 2, cx + 3, top + 2, [220, 200, 150]);
      g.line(cx, top + 1, cx, top + 4, [220, 200, 150]);
    },
  });
}

// A pumpkin: orange, ribbed, with a glowing carved face. Land on it and ride off the far side, or ollie it.
export function pumpkin({ x, w = 50, h = 36 }) {
  const block = box({ x, w, h, landable: true });
  return {
    ...block,
    type: 'pumpkin',
    draw(g, fx = {}) {
      const [l, t, r, b] = [P(x), P(G - h), P(x + w) - 1, P(G) - 1];
      const cx = (l + r) >> 1;
      const rx = (r - l) / 2;
      const ry = (b - t) / 2;
      const cy = (t + b) >> 1;
      for (let py = t; py <= b; py++) {
        const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - ((py - cy) / ry) ** 2)));
        g.fill(cx - half, py, half * 2 + 1, 1, PUMPKIN.body);
        g.pset(cx - half - 1, py, ink);
        g.pset(cx + half + 1, py, ink);
        g.pset(cx - half, py, PUMPKIN.lit);
        g.pset(cx + half, py, PUMPKIN.dark);
        for (const f of [-0.5, 0, 0.5]) g.pset(cx + Math.round(half * f), py, PUMPKIN.dark); // ribs
      }
      g.line(cx - 4, t - 1, cx + 4, t - 1, ink);
      g.fill(cx - 1, t - 3, 3, 3, PUMPKIN.stem);
      g.rect(cx - 2, t - 4, 5, 5, ink);
      g.fill(cx - 1, t - 3, 3, 3, PUMPKIN.stem);
      const flick = Math.floor(Math.max(0, fx.time || 0) * 4) % 3;
      const lit = GLOW[flick % 3];
      for (const ex of [cx - 5, cx + 3]) { g.fill(ex, cy - 3, 3, 3, lit); g.pset(ex + 1, cy - 4, lit); }
      g.fill(cx - 3, cy + 2, 7, 2, lit);
      g.pset(cx - 2, cy + 4, lit);
      g.pset(cx + 2, cy + 4, lit);
    },
  };
}

// A coffin stood on its end, lid on. A tall solid hurdle: ollie it. Three looks to pick from (`kind`):
// 'classic' a hexagonal wooden coffin with a brass cross, 'vampire' a black coffin with purple trim and a
// skull plate, 'sarcophagus' a carved stone one with moss.
const COFFIN_KINDS = {
  classic: { body: WOOD.a, lit: WOOD.lit, dark: WOOD.dark, panel: WOOD.b, trim: [190, 150, 90], mark: [236, 214, 150], taper: 0.62 },
  vampire: { body: [52, 42, 70], lit: [104, 90, 140], dark: [24, 18, 38], panel: [36, 28, 52], trim: [150, 90, 200], mark: [236, 232, 240], taper: 0.62 },
  sarcophagus: { body: STONE.body, lit: STONE.lit, dark: STONE.dark, panel: [124, 120, 140], trim: STONE.lit, mark: STONE.dark, taper: 0.9 },
};
export function coffinUp({ x, w = 57, h = 86, kind = 'classic' }) {
  const block = box({ x, w, h });
  const C = COFFIN_KINDS[kind] || COFFIN_KINDS.classic;
  return {
    ...block,
    type: 'coffin-up',
    draw(g) {
      const [l, t, r, b] = [P(x), P(G - h), P(x + w) - 1, P(G) - 1];
      const cx = (l + r) >> 1;
      const full = (r - l) / 2;
      // half-width per row: a hexagon (narrow head, wide shoulders, tapering foot); the sarcophagus is a
      // squarer slab with a rounded top
      const halfAt = (py) => {
        const k = (py - t) / (b - t);
        if (kind === 'sarcophagus') return Math.round(full * (k < 0.06 ? 0.7 + k * 5 : 1));
        if (k < 0.2) return Math.round(full * (0.55 + (k / 0.2) * 0.45));
        return Math.round(full * (1 - ((k - 0.2) / 0.8) * (1 - C.taper)));
      };
      let prev = halfAt(t);
      for (let py = t; py <= b; py++) {
        const half = halfAt(py);
        g.fill(cx - half, py, half * 2 + 1, 1, C.body);
        // the outline follows the slanted sides without gaps
        for (let o = Math.min(half, prev) + 1; o <= Math.max(half, prev) + 1; o++) { g.pset(cx - o, py, ink); g.pset(cx + o, py, ink); }
        g.pset(cx - half, py, C.lit);
        g.pset(cx - half + 1, py, C.lit);
        g.pset(cx + half, py, C.dark);
        g.pset(cx + half - 1, py, C.dark);
        prev = half;
      }
      g.line(cx - halfAt(t), t - 1, cx + halfAt(t), t - 1, ink);
      g.line(cx - halfAt(t) + 1, t, cx + halfAt(t) - 1, t, C.lit);
      // the lid panel, inset with a bevel
      const pt = t + 6;
      const pb = b - 6;
      const ph = Math.max(3, halfAt(pb) - 3);
      g.fill(cx - ph, pt, ph * 2 + 1, pb - pt, C.panel);
      g.rect(cx - ph - 1, pt - 1, ph * 2 + 3, pb - pt + 2, C.dark);
      g.line(cx - ph, pt, cx + ph, pt, C.dark);
      g.line(cx - ph, pb - 1, cx + ph, pb - 1, C.lit);
      if (kind === 'vampire') {
        // a skull plate and a pair of fangs, trim studs down the sides
        g.fill(cx - 3, pt + 5, 7, 6, C.mark);
        g.fill(cx - 2, pt + 11, 5, 2, C.mark);
        g.fill(cx - 2, pt + 7, 2, 2, C.dark);
        g.fill(cx + 1, pt + 7, 2, 2, C.dark);
        g.pset(cx, pt + 10, C.dark);
        g.pset(cx - 1, pt + 12, C.dark);
        g.pset(cx + 1, pt + 12, C.dark);
        for (const sy of [pt + 18, pt + 24]) { g.pset(cx - ph + 2, sy, C.trim); g.pset(cx + ph - 2, sy, C.trim); }
        g.line(cx - ph + 1, pb - 4, cx + ph - 1, pb - 4, C.trim);
      } else {
        // a cross on the lid
        g.line(cx, pt + 3, cx, pt + 14, C.mark);
        g.line(cx - 3, pt + 6, cx + 3, pt + 6, C.mark);
        g.line(cx + 1, pt + 4, cx + 1, pt + 14, C.dark);
        if (kind === 'sarcophagus') for (let px = l + 2; px < r - 2; px += 5) g.pset(px, b - 2, STONE.moss);
        else for (const hy of [pt + 20, pt + 26]) { g.pset(cx - ph + 1, hy, C.trim); g.pset(cx + ph - 1, hy, C.trim); } // handle studs
      }
      g.line(l + 2, b, r - 2, b, ink);
    },
  };
}

// A lantern gate: two iron posts with a crossbar and glowing lanterns hanging from it. Pass under it, or
// jump through it (head inside the opening) for a bonus; head above the bar and you hit it.
export function lanternGate({ x, top, bottom, name = 'GHOST GATE', points = 250 }) {
  return gate({
    type: 'lantern-gate',
    x,
    top,
    bottom,
    name,
    points,
    paint(g, fx, hz) {
      const cx = P(x);
      const t = P(hz.top);
      const ground = P(G) - 1;
      const reach = 8;
      for (const px of [cx - reach, cx + reach]) {
        for (let py = t - 3; py <= ground; py++) { g.pset(px - 1, py, ink); g.pset(px + 1, py, ink); g.pset(px, py, py % 7 < 2 ? IRON.lit : IRON.body); }
        g.fill(px - 2, t - 5, 5, 2, IRON.body); // a spear top
        g.pset(px, t - 6, IRON.lit);
        g.fill(px - 2, ground, 5, 1, ink);
      }
      g.line(cx - reach, t - 1, cx + reach, t - 1, ink);
      g.line(cx - reach, t, cx + reach, t, IRON.body);
      const flick = Math.floor(Math.max(0, fx.time || 0) * 5) % 3;
      for (const lx of [cx - 4, cx + 4]) {
        g.line(lx, t + 1, lx, t + 3, ink);
        g.fill(lx - 1, t + 4, 3, 4, GLOW[flick]);
        g.rect(lx - 2, t + 3, 5, 6, ink);
        g.fill(lx - 1, t + 4, 3, 4, GLOW[flick]);
      }
    },
  });
}

// A mausoleum: a stone tomb with columns and a gargoyle on one corner. Ollie up onto the roof and ride it,
// lock a grind on the roof edge, or fly the lot. Roll off the end and drop back to the street.
export function mausoleum({ x, w = 230, h = 70 }) {
  const block = box({ x, w, h, landable: true, grindable: true });
  return {
    ...block,
    type: 'mausoleum',
    draw(g, fx = {}) {
      const [l, t, r, b] = [P(x), P(G - h), P(x + w) - 1, P(G) - 1];
      g.fill(l, t + 3, r - l + 1, b - t - 2, STONE.body);
      for (let py = t + 6; py < b; py += 5) { g.line(l + 1, py, r - 1, py, STONE.dark); for (let px = l + 4 + ((py / 5) % 2) * 5; px < r; px += 10) g.pset(px, py + 2, STONE.dark); }
      g.rect(l, t + 3, r - l + 1, b - t - 2, ink);
      // the roof slab you ride on, with a lit edge
      g.fill(l - 2, t - 2, r - l + 5, 6, STONE.lit);
      g.rect(l - 2, t - 3, r - l + 5, 7, ink);
      g.line(l - 1, t - 2, r + 1, t - 2, [236, 232, 248]);
      g.line(l - 1, t + 3, r + 1, t + 3, STONE.dark);
      // columns either side of a dark doorway with a glow inside
      const dw = 12;
      const dx = ((l + r) >> 1) - (dw >> 1);
      g.fill(dx, t + 14, dw, b - t - 13, [14, 10, 24]);
      g.rect(dx - 1, t + 13, dw + 2, b - t - 12, ink);
      const flick = Math.floor(Math.max(0, fx.time || 0) * 3) % 2;
      g.fill(dx + 4, b - 6, 4, 4, flick ? [120, 255, 170] : [80, 200, 130]);
      for (const cxp of [dx - 8, dx + dw + 6]) { g.fill(cxp, t + 6, 3, b - t - 5, STONE.lit); g.rect(cxp - 1, t + 5, 5, b - t - 4, ink); g.fill(cxp, t + 6, 3, b - t - 5, STONE.lit); g.line(cxp + 2, t + 6, cxp + 2, b - 1, STONE.dark); }
      // a plain lintel plaque over the door with a small carved cross (no lettering over the brickwork)
      const lx = dx - 4;
      g.fill(lx, t + 6, dw + 8, 6, STONE.lit);
      g.rect(lx - 1, t + 5, dw + 10, 8, ink);
      g.fill(lx, t + 6, dw + 8, 6, STONE.lit);
      g.fill(lx + (dw + 8) / 2 - 1, t + 7, 1, 4, STONE.dark);
      g.fill(lx + (dw + 8) / 2 - 2, t + 8, 3, 1, STONE.dark);
      // a gargoyle crouched on the far corner of the roof
      const gx = r - 8;
      g.fill(gx, t - 9, 6, 6, STONE.body);
      g.rect(gx - 1, t - 10, 8, 8, ink);
      g.fill(gx, t - 9, 6, 6, STONE.body);
      g.pset(gx + 1, t - 8, [255, 80, 80]);
      g.pset(gx + 4, t - 8, [255, 80, 80]);
      g.pset(gx - 1, t - 12, ink); g.pset(gx + 6, t - 12, ink);
      g.pset(gx, t - 11, STONE.body); g.pset(gx + 5, t - 11, STONE.body);
    },
  };
}

// The haunted mansion at the end of the road: a dark silhouette with lit windows and a gate. Scenery only.
export function mansion({ x }) {
  return {
    type: 'mansion',
    surfaces: [],
    solids: [],
    draw(g, fx = {}) {
      const cx = P(x);
      const ground = P(G) - 1;
      const body = [48, 34, 70];
      const edge = [24, 16, 38];
      g.fill(cx - 36, ground - 52, 72, 52, body);
      g.rect(cx - 37, ground - 53, 74, 54, ink);
      g.fill(cx - 14, ground - 76, 28, 24, body); // the tower
      g.rect(cx - 15, ground - 77, 30, 26, ink);
      for (let i = 0; i < 14; i++) { g.fill(cx - 17 + i, ground - 90 + Math.abs(7 - i) * 2 + 1 - 7, 1, 14 - Math.abs(7 - i) * 2 + 6, edge); } // a pointed roof
      g.line(cx - 36, ground - 53, cx, ground - 66, ink);
      g.line(cx + 36, ground - 53, cx, ground - 66, ink);
      const flick = Math.floor(Math.max(0, fx.time || 0) * 2.5);
      const wins = [[-28, -44], [-16, -44], [10, -44], [22, -44], [-4, -68], [-26, -26], [18, -26]];
      wins.forEach(([wx, wy], i) => {
        const on = (i + flick) % 5 !== 0;
        g.fill(cx + wx, ground + wy, 5, 8, on ? GLOW[i % 2] : [30, 24, 46]);
        g.rect(cx + wx - 1, ground + wy - 1, 7, 10, ink);
        g.line(cx + wx + 2, ground + wy, cx + wx + 2, ground + wy + 7, ink);
      });
      g.fill(cx - 5, ground - 18, 10, 18, [20, 14, 32]); // the door
      g.rect(cx - 6, ground - 19, 12, 20, ink);
      g.text('HAUNTED', cx, ground - 60, [230, 200, 255], 1, 'center');
    },
  };
}
