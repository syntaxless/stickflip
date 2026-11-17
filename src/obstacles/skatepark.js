import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';
import { box } from './box.js';
import { rail } from './rail.js';
import { stairs } from './stairs.js';

// Stage 5's skate park. Pieces that sit ON the street rather than being earth:
// their ground segments are flagged `under`, so the renderer draws the plain
// street column beneath and the piece paints itself over the top.
const P = (v) => Math.round(v / 3);
const G = WORLD.GROUND;
const { ink, steel, shine, wheel: white } = PAL;
const CONCRETE = [190, 190, 196];
const CONCRETE_LIT = [226, 226, 230];
const CONCRETE_DARK = [128, 128, 138];
const WOOD = [176, 108, 50];
const WOOD_LIGHT = [210, 140, 70];
const WOOD_DARK = [120, 68, 28];

// Paint a solid shape over the street from `topAt(px)` (a pixel row) down to
// the street, column by column, with a colour chosen by `shade(px, y, depth)`.
function fillShape(g, l, r, topAt, shade) {
  const floor = P(G) - 1;
  for (let px = l; px <= r; px++) {
    const t = topAt(px);
    for (let y = t; y <= floor; y++) g.pset(px, y, shade(px, y, y - t));
    g.pset(px, t, ink); // outline along the top edge
  }
}

// A hubba: a low ledge running down beside a stair set. The ledge is a solid
// concrete wall; its top edge is the thing to grind (like a handrail, you pass
// it unless you tap just before it), or ollie the whole set.
export function hubba({ x, steps = 5, run = 46, rise = 16, wallHeight = 32 }) {
  const base = stairs({ x, steps, run, rise, handrail: false });
  const top = G - steps * rise;
  const end = x + (steps - 1) * run;
  const edge = { x1: x, x2: end, y1: top - wallHeight, y2: G - wallHeight, grindable: true, passable: true, landable: false };
  const edgeAt = (wx) => edge.y1 + ((edge.y2 - edge.y1) * (wx - x)) / (end - x);
  const treadAt = (wx) => Math.min(G, top + (Math.floor((wx - x) / run) + 1) * rise);
  return {
    ...base,
    type: 'hubba',
    surfaces: [edge],
    draw(g) {
      const [l, r] = [P(x), P(end)];
      for (let px = l; px <= r; px++) {
        const wx = px * 3;
        const t = P(edgeAt(wx));
        const b = P(treadAt(wx)) - 1;
        for (let y = t; y <= b; y++) {
          const d = y - t;
          g.pset(px, y, d < 2 ? CONCRETE_LIT : d > 9 && (px + y) % 7 === 0 ? CONCRETE_DARK : CONCRETE);
        }
        g.pset(px, t - 1, ink); // outline along the grindable top edge
        g.pset(px, t + 2, ink); // the lip's underside
      }
      for (const px of [l, r]) g.line(px, P(edgeAt(px * 3)) - 1, px, P(treadAt(px * 3)) - 1, ink); // ends
      for (let px = l + 8; px < r - 4; px += 14) g.pset(px, P(edgeAt(px * 3)), white); // glints on the edge
    },
  };
}

// A curb cut: a driveway entrance where the curb dips to the street. Two raised
// curbs (landable, grindable on top) with sloped flares down to a driveway at
// street level between them. Ride it, ollie onto a curb, or grind it.
export function curbCut({ x }) {
  const H = 30; // curb height
  const segs = [
    { x1: x, x2: x + 36, y1: G, y2: G - H }, // up the face of the first curb
    { x1: x + 36, x2: x + 150, y1: G - H, y2: G - H },
    { x1: x + 150, x2: x + 270, y1: G - H, y2: G }, // the flare down into the driveway
    { x1: x + 350, x2: x + 470, y1: G, y2: G - H }, // the flare back up
    { x1: x + 470, x2: x + 560, y1: G - H, y2: G - H },
    { x1: x + 560, x2: x + 596, y1: G - H, y2: G }, // down the far curb's face
  ].map((s) => ({ ...s, landable: true, under: true }));
  const tops = [
    { x1: x + 36, x2: x + 150, y: G - H, grindable: true, landable: true },
    { x1: x + 470, x2: x + 560, y: G - H, grindable: true, landable: true },
  ];
  const yAt = (wx) => {
    for (const s of segs) if (wx >= s.x1 && wx < s.x2) return s.y1 + ((s.y2 - s.y1) * (wx - s.x1)) / (s.x2 - s.x1);
    return G;
  };
  return {
    type: 'curb-cut',
    surfaces: tops,
    solids: [],
    ground: segs,
    draw(g) {
      fillShape(g, P(x), P(x + 596) - 1, (px) => P(yAt(px * 3)), (px, y, d) => {
        if (d < 2) return CONCRETE_LIT;
        // a joint line across each slab, darker toward the bottom
        if (px % 12 === 0) return CONCRETE_DARK;
        return d > 7 ? CONCRETE_DARK : CONCRETE;
      });
      // the curbs' edges: a darker face line where the curb meets the street
      for (const [a, b] of [[x, x + 36], [x + 560, x + 596]]) g.line(P(a), P(G) - 1, P(b), P(G) - 1, ink);
    },
  };
}

// A fun box: a wooden trapezoid sitting on the flat street, with a rail along
// its flat top. Ride up one end, ollie onto the rail and grind it, or ride it.
export function funBox({ x, topHeight = 50, up = 110, top = 190, down = 110, barHeight = 34 }) {
  const TOP = G - topHeight;
  const segs = [
    { x1: x, x2: x + up, y1: G, y2: TOP },
    { x1: x + up, x2: x + up + top, y1: TOP, y2: TOP },
    { x1: x + up + top, x2: x + up + top + down, y1: TOP, y2: G },
  ].map((s) => ({ ...s, landable: true, under: true }));
  const bar = rail({ x: x + up + 20, length: top - 40, height: barHeight, base: TOP });
  const yAt = (wx) => {
    for (const s of segs) if (wx >= s.x1 && wx < s.x2) return s.y1 + ((s.y2 - s.y1) * (wx - s.x1)) / (s.x2 - s.x1);
    return G;
  };
  return {
    type: 'fun-box',
    surfaces: bar.surfaces,
    solids: bar.solids,
    ground: segs,
    draw(g, fx) {
      fillShape(g, P(x), P(x + up + top + down) - 1, (px) => P(yAt(px * 3)), (px, y, d) => {
        if (d < 2) return WOOD_LIGHT;
        const plank = Math.floor(d / 4);
        if (d % 4 === 3) return WOOD_DARK; // the gap between planks
        return plank % 2 ? WOOD : WOOD_LIGHT;
      });
      bar.draw(g, fx);
    },
  };
}

// A wooden ramp, sitting on the street, rising from the street at x to
// `rise` high at x + run.
export function woodRamp({ x, run, rise }) {
  const seg = { x1: x, x2: x + run, y1: G, y2: G - rise, landable: true, under: true };
  return {
    type: 'wood-ramp',
    surfaces: [],
    solids: [],
    ground: [seg],
    draw(g) {
      fillShape(g, P(x), P(x + run) - 1, (px) => P(G - (rise * (px * 3 - x)) / run), (px, y, d) => {
        if (d < 2) return WOOD_LIGHT;
        if (d % 4 === 3) return WOOD_DARK;
        return Math.floor(d / 4) % 2 ? WOOD : WOOD_LIGHT;
      });
    },
  };
}

// A police car seen head-on, standing on the street. A solid you can't ride
// into (slam). Its light bar is the grindable bit: a short rail on the roof.
export function copCar({ x, w = 132, h = 99 }) {
  const solid = box({ x, w, h });
  const barY = G - h - 9; // top of the light bar
  const bar = { x1: x + 24, x2: x + w - 24, y: barY, grindable: true, landable: false };
  return {
    ...solid,
    type: 'cop-car',
    surfaces: [bar],
    draw(g, fx = {}) {
      const [l, r] = [P(x), P(x + w) - 1];
      const b = P(G) - 1;
      const wd = r - l + 1;
      const cx = (l + r) >> 1;
      const BLACK = [30, 30, 38];
      const GLASS = [150, 205, 240];
      const RED = [255, 60, 60];
      const BLUE = [70, 110, 255];
      // tyres
      for (const tx of [l + 3, r - 8]) {
        g.fill(tx, b - 5, 6, 6, ink);
        g.fill(tx + 1, b - 4, 4, 3, [60, 60, 66]);
      }
      // bumper and lower body: black with a steel grille and headlights
      g.fill(l, b - 15, wd, 10, BLACK);
      g.rect(l, b - 15, wd, 10, ink);
      g.fill(cx - 9, b - 13, 19, 6, steel);
      for (let gx = cx - 8; gx < cx + 9; gx += 3) g.line(gx, b - 13, gx, b - 8, ink);
      g.line(cx - 9, b - 13, cx + 9, b - 13, shine);
      for (const hx of [l + 3, r - 8]) {
        g.fill(hx, b - 13, 5, 3, white);
        g.rect(hx, b - 13, 5, 3, ink);
      }
      g.line(l + 1, b - 6, r - 1, b - 6, steel); // chrome bumper
      // hood: black with a white stripe, narrower than the body
      g.fill(l + 2, b - 21, wd - 4, 6, BLACK);
      g.rect(l + 2, b - 21, wd - 4, 6, ink);
      g.line(l + 4, b - 19, r - 4, b - 19, white);
      // cabin: white door frames around a pale-blue windscreen
      g.fill(l + 7, b - 31, wd - 14, 10, white);
      g.rect(l + 7, b - 31, wd - 14, 10, ink);
      g.fill(l + 10, b - 29, wd - 20, 6, GLASS);
      g.rect(l + 10, b - 29, wd - 20, 6, ink);
      g.line(l + 13, b - 28, l + 17, b - 28, white); // glint on the glass
      g.line(cx - 1, b - 29, cx - 1, b - 24, ink); // wiper
      // roof edge
      g.line(l + 8, b - 32, r - 8, b - 32, ink);
      // light bar: red and blue halves in a black housing, flashing
      const flash = Math.floor((fx.time || 0) * 5) % 2;
      const bl = l + 8;
      const br = r - 8;
      const bt = P(barY);
      g.fill(bl, bt, br - bl + 1, 3, BLACK);
      g.rect(bl, bt - 1, br - bl + 1, 5, ink);
      const mid = (bl + br) >> 1;
      g.fill(bl + 1, bt, mid - bl - 1, 3, flash ? [255, 140, 140] : RED);
      g.fill(mid + 1, bt, br - mid - 1, 3, flash ? BLUE : [150, 180, 255]);
      g.pset(bl + 2, bt, white);
      g.pset(mid + 2, bt, white);
      g.line(bl + 1, bt - 1, br - 1, bt - 1, shine); // the lit grind edge along the top of the bar
    },
  };
}
