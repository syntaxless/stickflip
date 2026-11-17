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

// A curb cut: a driveway entrance, a dip cut down into the ground (not a bump
// on top of it): sloped flares down to a driveway a little below the sidewalk
// and back up. A free ride; the concrete apron is drawn over the surface.
export function curbCut({ x }) {
  const D = 30; // how far the driveway dips below the sidewalk
  const segs = [
    { x1: x, x2: x + 130, y1: G, y2: G + D }, // the flare down into the driveway
    { x1: x + 130, x2: x + 270, y1: G + D, y2: G + D }, // the driveway, below the sidewalk
    { x1: x + 270, x2: x + 400, y1: G + D, y2: G }, // the flare back up
  ].map((s) => ({ ...s, landable: true }));
  const yAt = (wx) => {
    for (const s of segs) if (wx >= s.x1 && wx < s.x2) return s.y1 + ((s.y2 - s.y1) * (wx - s.x1)) / (s.x2 - s.x1);
    return G;
  };
  return {
    type: 'curb-cut',
    surfaces: [],
    solids: [],
    ground: segs,
    // The dip is cut into the ground; this lays a concrete apron over its surface.
    draw(g) {
      for (let px = P(x); px < P(x + 400); px++) {
        const t = P(yAt(px * 3));
        for (let d = 0; d < 6; d++) g.pset(px, t + d, d < 2 ? CONCRETE_LIT : px % 12 === 0 ? CONCRETE_DARK : d > 3 ? CONCRETE_DARK : CONCRETE);
        g.pset(px, t - 1, ink);
      }
      for (const wx of [x, x + 400]) g.line(P(wx), P(G) - 1, P(wx), P(G) + 1, ink); // the cut's edges
    },
  };
}

// A concrete set: big steps down to the street with no rail, in poured concrete
// (the platform from `from` to the top step is concrete too). Ollie or flip down.
export function concreteSet({ x, steps = 3, run = 100, rise = 48, from = 0 }) {
  const base = stairs({ x, steps, run, rise, handrail: false });
  const top = G - steps * rise;
  const end = x + (steps - 1) * run;
  const yAt = (wx) => (wx < x ? top : wx >= end ? G : top + (Math.floor((wx - x) / run) + 1) * rise);
  return {
    ...base,
    type: 'concrete-set',
    ground: base.ground.map((seg) => ({ ...seg, under: true })),
    draw(g) {
      fillShape(g, P(from), P(end) - 1, (px) => P(yAt(px * 3)), (px, y, d) => {
        if (d < 2) return CONCRETE_LIT; // lit top edge
        if (d > 3 && (px * 7 + y * 13) % 61 === 0) return CONCRETE_DARK; // a crack
        if ((px * 3 + y * 5) % 19 === 0) return CONCRETE_LIT; // speckle
        if (px % 28 === 0) return CONCRETE_DARK; // slab joint
        return CONCRETE;
      });
      for (let i = 1; i <= steps; i++) {
        const px = P(x + (i - 1) * run);
        g.line(px, P(yAt(px * 3 - 3)), px, P(yAt(px * 3 + 3)) - 1, ink); // riser outline
      }
    },
  };
}

// A fun box: a wooden trapezoid sitting on the flat street, with a rail along
// its flat top. Ride up one end, ollie onto the rail and grind it, or ride it.
export function funBox({ x, topHeight = 50, up = 130, top = 220, down = 130, barHeight = 34 }) {
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
// Grind it and, once the grind is over, the car blows up in a cartoon blast and
// is left a smoking wreck. (Ollie over it and nothing happens.) The blast is
// only a drawing: it never hurts the rider or changes anything about the car.
const hash = (a, b) => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
};

export function copCar({ x, w = 132, h = 99 }) {
  const solid = box({ x, w, h });
  const barY = G - h - 9; // top of the light bar
  const bar = { x1: x + 24, x2: x + w - 24, y: barY, grindable: true, landable: false, explodes: true };
  return {
    ...solid,
    type: 'cop-car',
    surfaces: [bar],
    draw(g, fx = {}) {
      const [l, r] = [P(x), P(x + w) - 1];
      const b = P(G) - 1;
      const age = fx.boom ?? null; // seconds since the blast, or null while the car is whole
      if (age === null || age < 0.3) drawCar(g, l, r, b, barY, fx);
      else drawWreck(g, l, r, b, age, fx.time || 0);
      if (age !== null) drawBlast(g, l, r, b, age, fx.time || 0);
    },
  };
}

function drawCar(g, l, r, b, barY, fx) {
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
}

// What's left: a charred, caved-in shell on flat tyres, the hood sprung up, the
// glass gone and shards of the light bar on the roof.
function drawWreck(g, l, r, b, age, time) {
  const wd = r - l + 1;
  const cx = (l + r) >> 1;
  const CHAR = [44, 42, 48];
  const CHAR_LIT = [84, 82, 90];
  const SCORCH = [18, 16, 20];
  for (const tx of [l + 3, r - 9]) g.fill(tx, b - 3, 7, 4, ink); // flat tyres
  g.fill(l, b - 13, wd, 9, CHAR); // the lower body
  g.rect(l, b - 13, wd, 9, ink);
  g.line(l + 1, b - 12, r - 1, b - 12, CHAR_LIT);
  g.fill(cx - 9, b - 11, 19, 5, SCORCH); // the grille, blown in
  g.line(l + 1, b - 5, l + 9, b - 3, ink); // a bumper hanging off
  // the cabin: caved in, with a jagged roof
  for (let px = l + 7; px <= r - 7; px++) {
    const top = b - 26 - ((hash(px, 3) % 4) - (px > cx ? 2 : 0));
    g.fill(px, top, 1, b - 13 - top, px % 5 === 0 ? CHAR_LIT : CHAR);
    g.pset(px, top, ink);
  }
  g.line(l + 7, b - 25, l + 7, b - 13, ink);
  g.line(r - 7, b - 25, r - 7, b - 13, ink);
  g.fill(l + 12, b - 22, wd - 24, 7, SCORCH); // the windows, blown out
  g.fill(l + 9, b - 20, 4, 5, [150, 150, 150]); // a scorched bit of white door
  // the hood sprung up
  g.line(cx - 12, b - 14, cx - 6, b - 28, ink);
  g.line(cx - 11, b - 14, cx - 5, b - 28, CHAR_LIT);
  // shards of the light bar
  g.fill(l + 14, b - 27, 3, 2, [255, 60, 60]);
  g.fill(r - 18, b - 28, 3, 2, [70, 110, 255]);
  g.pset(cx + 3, b - 29, white);
  // flames licking out of the wreck for a few seconds, then it just smokes
  if (age < 4.5) {
    const strength = age < 2.5 ? 1 : 1 - (age - 2.5) / 2;
    for (let i = 0; i < 5; i++) {
      const fx = l + 10 + i * Math.round((wd - 24) / 4);
      const hgt = Math.round((3 + ((Math.floor(time * 9) + i * 3) % 4)) * strength);
      const top = b - 27 + (i % 2) * 3;
      for (let k = 0; k < hgt; k++) {
        const wid = Math.max(1, 3 - Math.floor((k * 3) / Math.max(1, hgt)));
        g.fill(fx - (wid >> 1), top - k, wid, 1, k < hgt - 2 ? [255, 120, 30] : [255, 230, 90]);
      }
    }
  }
}

// The cartoon blast: a white flash, a fireball that swells and shrinks, flying
// scrap, then smoke rising for as long as the wreck sits there.
function drawBlast(g, l, r, b, age, time) {
  const cx = (l + r) >> 1;
  const cy = b - 18;
  if (age < 0.1) g.fill(l - 6, b - 44, r - l + 13, 46, white); // the flash
  if (age < 0.8) {
    const grow = age < 0.45 ? Math.sin((Math.max(0, age - 0.05) / 0.4) * (Math.PI / 2)) : 1 - (age - 0.45) / 0.35;
    const R = Math.round(6 + 24 * Math.max(0, grow));
    const lumps = [[0, 0, 1], [-0.55, -0.2, 0.7], [0.55, -0.25, 0.75], [-0.2, -0.6, 0.65], [0.25, 0.1, 0.6]];
    for (const [c, tint] of [[[255, 60, 40], 1], [[255, 140, 30], 0.82], [[255, 230, 80], 0.6], [[255, 255, 235], 0.32]]) {
      for (const [dx, dy, sz] of lumps) g.circle(cx + Math.round(dx * R), cy + Math.round(dy * R), Math.max(1, Math.round(R * sz * tint)), c, true);
    }
  }
  // scrap thrown out of it: small dark, orange and white bits on arcs
  if (age < 1.2) {
    for (let k = 0; k < 12; k++) {
      const ang = (hash(k, 7) % 628) / 100;
      const speed = 30 + (hash(k, 9) % 70);
      const px = cx + Math.round(Math.cos(ang) * speed * age);
      const py = cy - Math.abs(Math.round(Math.sin(ang) * speed * age)) - Math.round(14 * age) + Math.round(110 * age * age * 0.5);
      const c = [[60, 58, 66], [255, 140, 30], white, [140, 140, 150]][k % 4];
      g.fill(px, py, 2, 2, c);
    }
  }
  // smoke: grey puffs that rise and thin out, over and over
  if (age > 0.3) {
    for (let i = 0; i < 6; i++) {
      const phase = (time * 0.5 + i / 6) % 1;
      const sx = cx + (i - 2.5) * 5 + Math.round(Math.sin(time * 1.3 + i * 2) * 3);
      const sy = b - 28 - Math.round(phase * 38);
      const size = 3 + Math.round(phase * 4);
      const shade = 70 + Math.round(phase * 90);
      for (let yy = 0; yy < size; yy++) {
        for (let xx = 0; xx < size; xx++) if ((xx + yy + i) % (1 + Math.floor(phase * 2.5)) === 0) g.pset(sx + xx, sy + yy, [shade, shade, shade + 6]);
      }
    }
  }
}
