import { box } from './box.js';
import { rail } from './rail.js';
import { P, G, ink, hash, gate, pit, POOL_DEPTH } from './art.js';

// Junkyard's own pieces (Stage 9): tyre heaps and stacks, fridges and washers, a wrecked car, a pit of
// toxic sludge, a steel beam hung over it, a crane's wrecking ball. Chunky shaded pixel art like the rest:
// black outline, a lit edge, a darker foot.
const RUBBER = { body: [38, 38, 46], lit: [92, 92, 108], dark: [18, 18, 24], hub: [150, 150, 160] };
const RUST = { a: [170, 86, 46], b: [138, 64, 34], lit: [220, 134, 76], dark: [84, 40, 24] };
const STEEL = { body: [150, 156, 170], lit: [214, 220, 232], dark: [84, 90, 106] };
const SLUDGE = { deep: [30, 62, 24], mid: [70, 140, 36], light: [160, 224, 70], glow: [214, 255, 120] };
const YELLOW = [250, 200, 40];

// A heap of tyres: the street rises to a lumpy crest and falls away. Tyres heaped over the planks.
export function tireHill({ x, run = 80, h = 30 }) {
  const up = { x1: x, x2: x + run, y1: G, y2: G - h, landable: true };
  const down = { x1: x + run, x2: x + 2 * run, y1: G - h, y2: G, landable: true };
  return {
    type: 'tire-hill',
    surfaces: [],
    solids: [],
    ground: [up, down],
    draw(g) {
      for (let px = P(x); px < P(x + 2 * run); px++) {
        const wx = px * 3 + 1;
        const k = wx < x + run ? (wx - x) / run : 1 - (wx - x - run) / run;
        const top = P(G - h * k);
        for (let py = top; py <= P(G) - 1; py++) {
          const ring = (px + (py >> 2) * 3) % 7; // rows of tyres, each offset from the one above
          const edge = ring === 0 || (py - top) % 4 === 3;
          g.pset(px, py, py === top ? RUBBER.lit : edge ? RUBBER.dark : ring === 3 && (py % 4 === 1) ? RUBBER.hub : ring < 3 ? RUBBER.body : RUBBER.lit && hash(px, py) % 5 === 0 ? RUBBER.lit : RUBBER.body);
        }
        if (k > 0.05) g.pset(px, top - 1, ink);
      }
    },
  };
}

// A stack of tyres, tall enough to need an ollie. A solid hurdle; the top is grindable.
export function tireStack({ x, w = 56, h = 40 }) {
  const block = box({ x, w, h, grindable: true });
  return {
    ...block,
    type: 'tire-stack',
    draw(g) {
      const [l, t, r, b] = [P(x), P(G - h), P(x + w) - 1, P(G) - 1];
      const rows = Math.ceil((b - t + 1) / 6);
      for (let i = 0; i < rows; i++) {
        const y0 = b - (i + 1) * 6 + 1;
        const off = i % 2 ? 2 : 0;
        const l2 = l + off;
        const r2 = r - (i % 2 ? 0 : 2);
        g.fill(l2, Math.max(t, y0), r2 - l2 + 1, Math.min(6, b - Math.max(t, y0) + 1), RUBBER.body);
        g.rect(l2, Math.max(t, y0), r2 - l2 + 1, Math.min(6, b - Math.max(t, y0) + 1), ink);
        g.line(l2 + 1, Math.max(t, y0) + 1, r2 - 1, Math.max(t, y0) + 1, RUBBER.lit);
        for (let hx = l2 + 5; hx < r2 - 3; hx += 9) g.pset(hx, Math.max(t, y0) + 3, RUBBER.hub); // hub holes
      }
    },
  };
}

// A fridge or a washer dumped in the road: a solid hurdle with a grindable top edge.
export function appliance({ x, w = 54, h = 46, kind = 'fridge' }) {
  const block = box({ x, w, h, grindable: true });
  return {
    ...block,
    type: kind,
    draw(g) {
      const [l, t, r, b] = [P(x), P(G - h), P(x + w) - 1, P(G) - 1];
      const body = kind === 'fridge' ? [226, 226, 214] : [214, 222, 232];
      g.fill(l, t, r - l + 1, b - t + 1, body);
      g.rect(l, t, r - l + 1, b - t + 1, ink);
      g.line(l + 1, t + 1, r - 1, t + 1, [255, 255, 255]);
      g.line(l + 1, b - 1, r - 1, b - 1, [150, 156, 160]);
      for (let px = l + 2; px < r - 1; px += 3) for (let py = t + 3; py < b - 1; py++) if (hash(px, py) % 23 === 0) g.pset(px, py, RUST.b); // rust freckles
      g.fill(l + 1, b - 4, Math.round((r - l) * 0.4), 3, RUST.a); // rust creeping up from the foot
      if (kind === 'fridge') {
        g.line(l + 1, t + Math.round((b - t) * 0.38), r - 1, t + Math.round((b - t) * 0.38), ink); // freezer door
        g.fill(r - 4, t + 4, 1, 4, STEEL.dark); // handles
        g.fill(r - 4, t + Math.round((b - t) * 0.38) + 4, 1, 5, STEEL.dark);
      } else {
        const cx = (l + r) >> 1;
        const cy = t + Math.round((b - t) * 0.58);
        g.circle(cx, cy, 5, ink, true);
        g.circle(cx, cy, 4, [120, 170, 210], true);
        g.circle(cx, cy, 2, [190, 225, 250], true);
        g.fill(l + 2, t + 2, 4, 2, [214, 60, 50]); // knobs
        g.fill(l + 8, t + 2, 4, 2, STEEL.dark);
      }
    },
  };
}

// A wrecked car up on blocks: a rusty body with smashed windows. Ollie up onto the roof and ride it, or
// grind its edge. Roll off the end and you drop back to the street.
export function carWreck({ x, w = 220, h = 60 }) {
  const block = box({ x, w, h, landable: true, grindable: true });
  return {
    ...block,
    type: 'car-wreck',
    draw(g) {
      const [l, t, r, b] = [P(x), P(G - h), P(x + w) - 1, P(G) - 1];
      g.fill(l, t, r - l + 1, b - t + 1, RUST.a);
      for (let py = t; py <= b; py++) for (let px = l; px <= r; px++) {
        const hb = hash(px >> 1, py >> 1) % 11;
        if (hb === 0) g.pset(px, py, RUST.dark);
        else if (hb === 1) g.pset(px, py, RUST.lit);
        else if (hb === 2) g.pset(px, py, RUST.b);
      }
      g.rect(l, t, r - l + 1, b - t + 1, ink);
      g.line(l + 1, t + 1, r - 1, t + 1, RUST.lit);
      g.line(l + 1, t + 2, r - 1, t + 2, RUST.lit);
      // a window band with smashed glass and a pillar in the middle, a door line, a headlight and a bumper
      const wy = t + 5;
      g.fill(l + 4, wy, r - l - 8, 8, [60, 76, 90]);
      g.rect(l + 3, wy - 1, r - l - 6, 10, ink);
      g.fill((l + r) >> 1, wy, 3, 8, RUST.b);
      for (const sx of [l + 10, r - 14]) { g.line(sx, wy + 1, sx + 5, wy + 6, [190, 210, 226]); g.line(sx + 4, wy + 1, sx + 1, wy + 7, [190, 210, 226]); }
      g.line(l + 8, wy + 11, l + 8, b - 5, ink);
      g.line(r - 8, wy + 11, r - 8, b - 5, ink);
      g.fill(r - 4, b - 14, 3, 4, [255, 230, 120]);
      g.fill(l, b - 5, r - l + 1, 3, STEEL.dark);
      g.line(l + 1, b - 5, r - 1, b - 5, STEEL.body);
    },
  };
}

// A pit of toxic sludge where the street should be: glowing green, bubbles popping, rusty drums at the lips.
// Come up short and you drop in (a gap bail).
export function sludgePit({ x, width }) {
  return pit({
    type: 'sludge',
    x,
    width,
    kind: 'water',
    paint(g, fx, { l, r, top }) {
      const t = fx.time || 0;
      g.fill(l, top, r - l + 1, POOL_DEPTH, SLUDGE.deep);
      g.fill(l, top + 1, r - l + 1, 11, SLUDGE.mid);
      for (let px = l; px <= r; px++) {
        const wave = Math.floor(Math.sin(px * 0.3 + t * 2) * 1 + 1);
        g.pset(px, top + 1 + wave, SLUDGE.light);
        const h = hash(px >> 1, 7);
        if (h % 8 === 0) { // bubbles rising and popping
          const ph = (t * 0.7 + (h % 100) / 100) % 1;
          g.pset(px, top + 11 - Math.round(ph * 10), ph > 0.85 ? SLUDGE.glow : SLUDGE.light);
        }
      }
      for (const px of [l - 1, r + 1]) g.line(px, top, px, top + POOL_DEPTH, ink);
      // oil drums standing at the lips
      for (const [px, d] of [[l - 1, -1], [r + 1, 1]]) {
        const dx = px + d * 3 - 3;
        g.fill(dx, top - 6, 7, 6, RUST.a);
        g.rect(dx - 1, top - 7, 9, 8, ink);
        g.line(dx, top - 4, dx + 6, top - 4, RUST.dark);
        g.line(dx, top - 6, dx + 6, top - 6, RUST.lit);
      }
    },
  });
}

// A steel I-beam hung over the pit: no posts to slam into, and you pass it unless you tap to lock a grind.
// It ends where it ends, so a grind drops you off past the pit.
export function steelBeam({ x, length, height, arc = 0 }) {
  const r = rail({ x, length, height, arc });
  r.surfaces[0].passable = true;
  r.solids = [];
  return {
    ...r,
    type: 'steel-beam',
    draw(g) {
      const [l, rr] = [P(x), P(x + length) - 1];
      const yAt = (px) => Math.round(P(G - height) - (arc ? (arc / 3) * 4 * ((px - l) / (rr - l)) * (1 - (px - l) / (rr - l)) : 0));
      for (let px = l; px <= rr; px++) {
        const y = yAt(px);
        g.pset(px, y - 1, ink);
        g.pset(px, y, STEEL.lit);
        g.pset(px, y + 1, STEEL.body);
        g.pset(px, y + 2, STEEL.dark);
        g.pset(px, y + 3, ink);
        if ((px - l) % 9 === 4) g.pset(px, y + 1, YELLOW); // hazard marks
      }
      for (const px of [l + 2, rr - 2]) g.line(px, yAt(px) + 3, px, P(G) - 1, STEEL.dark); // a chain down at each end
    },
  };
}

// A crane's wrecking ball hung over the road: head above the chain hits it, head between `bottom` and `top`
// goes through the opening for a bonus (and a turbo kick), below it you pass underneath.
export function wreckBall({ x, top, bottom, name = 'WRECKING BALL', points = 300 }) {
  return gate({
    type: 'wreck-ball',
    x,
    top,
    bottom,
    name,
    points,
    paint(g, fx, hz) {
      const cx = P(x);
      const t = P(hz.top);
      const ground = P(G) - 1;
      const sway = Math.round(Math.sin((fx.time || 0) * 2.2) * 1.4);
      // the crane: a yellow mast to the right, an arm out over the road
      const mast = cx + 16;
      for (let py = t - 16; py <= ground; py++) { g.pset(mast - 2, py, ink); g.pset(mast + 2, py, ink); g.fill(mast - 1, py, 3, 1, py % 6 < 3 ? YELLOW : [60, 60, 66]); }
      g.fill(cx - 8, t - 18, 28, 4, YELLOW);
      g.rect(cx - 9, t - 19, 30, 6, ink);
      g.line(cx - 8, t - 18, cx + 19, t - 18, [255, 236, 130]);
      for (let i = 0; i < 5; i++) g.pset(cx + sway * (i / 5), t - 14 + i * 2, ink); // chain
      g.circle(cx + sway, t - 5, 5, ink, true);
      g.circle(cx + sway, t - 5, 4, [58, 58, 70], true);
      g.pset(cx + sway - 2, t - 7, STEEL.lit);
      g.pset(cx + sway - 1, t - 8, STEEL.lit);
    },
  });
}
