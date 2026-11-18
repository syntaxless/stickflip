import { WORLD } from '../config.js';
import { PAL } from '../render/pixel.js';
import { box } from './box.js';
import { CAR_SPRITE, COP_SPRITES, blit } from './cop-sprites.js';
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
      if (age === null || age < 0.3) drawCar(g, l, r, b, barY, fx, age === null || age < 0.12);
      else drawWreck(g, l, r, b, age, fx.time || 0);
      if (age !== null) drawBlast(g, l, r, b, age, fx.time || 0);
      if (age !== null) drawCop(g, r, b, age); // out of the door and away
    },
  };
}

// A cop car seen head-on: black bumper, big headlights, a white hood with a gold star,
// a wide windscreen with the cop at the wheel and a full-width flashing light bar
// (whose lit top edge is the grindable bit, at barY).
function drawCar(g, l, r, b, barY, fx, cop = true) {
  const BLACK = [30, 30, 38];
  const RED = [255, 60, 60];
  const BLUE = [70, 110, 255];
  const flash = Math.floor((fx.time || 0) * 5) % 2;
  blit(g, CAR_SPRITE, l, b - 31); // the car itself is a pixel-grid sprite (cop-sprites.js)
  if (cop) {
    // the cop at the wheel, on the driver's side (the car's left, which is on the right as you look at it)
    g.fill(r - 15, b - 28, 3, 3, COP.SKIN);
    g.fill(r - 16, b - 29, 5, 1, COP.CAP);
    g.fill(r - 17, b - 25, 6, 2, COP.UNIFORM);
    g.pset(r - 14, b - 29, COP.BADGE);
    g.pset(r - 13, b - 27, ink);
  }
  // light bar: red and blue lenses in a black housing with posts down to the roof
  const bl = l + 8;
  const br = r - 8;
  const bt = P(barY);
  g.fill(bl + 2, bt + 3, 2, 3, BLACK);
  g.fill(br - 3, bt + 3, 2, 3, BLACK);
  g.fill(bl, bt, br - bl + 1, 3, BLACK);
  g.rect(bl, bt - 1, br - bl + 1, 5, ink);
  const m = (bl + br) >> 1;
  g.fill(bl + 1, bt, m - bl - 1, 3, flash ? [255, 140, 140] : RED);
  g.fill(m + 1, bt, br - m - 1, 3, flash ? BLUE : [150, 180, 255]);
  g.pset(bl + 2, bt, white);
  g.pset(m + 2, bt, white);
  g.line(bl + 1, bt - 1, br - 1, bt - 1, shine); // the lit grind edge along the top of the bar
  // the lit lens throws a little glow above the bar
  g.line(flash ? bl + 2 : m + 2, bt - 2, flash ? m - 2 : br - 2, bt - 2, flash ? [255, 150, 150] : [140, 170, 255]);
}

// What's left: a charred, caved-in shell on flat tyres, the hood sprung up, the
// glass gone and shards of the light bar on the roof.
function drawWreck(g, l, r, b, age, time) {
  const wd = r - l + 1;
  const cx = (l + r) >> 1;
  const CHAR = [58, 56, 64];
  const CHAR_LIT = [112, 110, 120];
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

// The cop: tumbles out of the driver's door (the car's right side as you look at
// it) as the car goes up, then runs off to the right with his arms flapping, out
// of the picture. Cartoon only: he is never hurt and the rider can't touch him.
export const COP = { UNIFORM: [40, 70, 150], SKIN: [255, 212, 165], CAP: [24, 40, 100], BADGE: [255, 205, 70] };
function drawCop(g, r, b, age) {
  const t = age - 0.12;
  if (t < 0) return;
  const jump = 0.35;
  const k = Math.min(1, t / jump);
  let x;
  let y; // the soles of his boots
  let pose;
  if (t < jump) {
    x = r - 3 + Math.round(11 * k);
    y = b - 10 + Math.round(10 * k) - Math.round(9 * Math.sin(Math.PI * k));
    pose = 'jump';
  } else {
    x = r + 8 + Math.round(78 * (t - jump));
    y = b;
    pose = Math.floor((t - jump) * 9) % 2 ? 'runA' : 'runB';
  }
  blit(g, COP_SPRITES[pose], x - 5, y - 16);
  // a little "!" over his head while he panics
  if (t < 0.9 && Math.floor(t * 12) % 2 === 0) {
    g.line(x + 6, y - 23, x + 6, y - 20, [255, 60, 60]);
    g.pset(x + 6, y - 18, [255, 60, 60]);
  }
}

// The cartoon blast, in chunky pixel-art: everything sits on a 3x3 grid of "big
// pixels", the colours are hard flat steps (white, yellow, orange, red, smoke grey)
// with a black outline, and it plays as a few separate frames, not a smooth tween.
// No circles, no blur, no fades. Frames last 0.1 s; the whole fireball is over by 0.8 s.
const CELL = 3;
const FIRE = [[255, 255, 235], [255, 230, 80], [255, 140, 30], [255, 60, 40], [170, 30, 30]];
const SMOKE = [[92, 92, 100], [140, 140, 150]];
// fireball radius (in big pixels) for each 0.1 s frame; the blast swells and then collapses
const FIREBALL = [3, 5, 7, 8, 7, 5, 4, 2];
const LUMPS = [[0, 0, 1], [-0.6, -0.25, 0.7], [0.6, -0.3, 0.75], [-0.2, -0.65, 0.65], [0.3, 0.15, 0.6]];

// draw a set of big-pixel cells (keys "i,j") with a black outline round it
function cells(g, cx, cy, set, colourOf) {
  const key = (i, j) => i + ',' + j;
  for (const k of set) {
    const [i, j] = k.split(',').map(Number);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!set.has(key(i + di, j + dj))) g.fill(cx + (i + di) * CELL, cy + (j + dj) * CELL, CELL, CELL, ink);
    }
  }
  for (const k of set) {
    const [i, j] = k.split(',').map(Number);
    g.fill(cx + i * CELL, cy + j * CELL, CELL, CELL, colourOf(i, j));
  }
}

function drawBlast(g, l, r, b, age, time) {
  const cx = (l + r) >> 1;
  const cy = b - 18;
  const frame = Math.floor(age / 0.1);
  if (age < 0.12) {
    // the flash: a white square-pixel star
    const set = new Set();
    for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) {
      const n = Math.abs(i) + Math.abs(j);
      if ((i === 0 || j === 0) && n <= 5) set.add(i + ',' + j);
      else if (n <= 2) set.add(i + ',' + j);
    }
    cells(g, cx, cy, set, (i, j) => (Math.abs(i) + Math.abs(j) <= 1 ? FIRE[0] : FIRE[1]));
  }
  if (frame < FIREBALL.length) {
    const R = FIREBALL[frame];
    const set = new Set();
    for (const [dx, dy, sz] of LUMPS) {
      const lr = Math.max(1, Math.round(R * sz));
      const lx = Math.round(dx * R), ly = Math.round(dy * R);
      for (let i = -lr; i <= lr; i++) for (let j = -lr; j <= lr; j++) {
        // a blocky octagon rather than a round disc, with a few bites taken out per frame
        if (Math.abs(i) + Math.abs(j) > lr * 1.5) continue;
        if (lr > 3 && hash(i + lx + 20, j + ly + 20 + frame * 7) % 9 === 0 && Math.abs(i) + Math.abs(j) > lr) continue;
        set.add((i + lx) + ',' + (j + ly));
      }
    }
    const late = frame >= 5; // dying down: the white and yellow are gone
    cells(g, cx, cy, set, (i, j) => {
      const d = Math.hypot(i, j * 1.1) / Math.max(1, R);
      const step = d < 0.3 ? 0 : d < 0.55 ? 1 : d < 0.8 ? 2 : 3;
      return FIRE[Math.min(4, Math.max(step + (late ? 1 : 0), frame >= 7 ? 4 : 0))];
    });
  }
  // scrap thrown out of it: square chunks in four colours, stepping along their arcs
  if (age < 1.2) {
    const t = Math.floor(age / 0.1) * 0.1; // moves in steps
    for (let k = 0; k < 12; k++) {
      const ang = (hash(k, 7) % 628) / 100;
      const speed = 30 + (hash(k, 9) % 70);
      const px = cx + Math.round((Math.cos(ang) * speed * t) / CELL) * CELL;
      const py = cy - Math.abs(Math.round((Math.sin(ang) * speed * t) / CELL) * CELL) - Math.round((14 * t) / CELL) * CELL + Math.round((55 * t * t) / CELL) * CELL;
      const c = [[60, 58, 66], FIRE[2], FIRE[0], SMOKE[1]][k % 4];
      g.fill(px - 1, py - 1, 4, 4, ink);
      g.fill(px, py, 2, 2, c);
    }
  }
  // smoke: flat grey squares that rise in steps, two shades, black outline, no fade
  if (age > 0.3) {
    for (let i = 0; i < 4; i++) {
      const step = Math.floor((time * 2.5 + i / 4 * 5) % 5); // 5 positions of the rise
      const sx = cx + (i - 1.5) * 9 + (hash(i, step) % 2) * 3;
      const sy = b - 30 - step * 6;
      const n = step < 2 ? 1 : step < 4 ? 2 : 3; // grows as it rises
      const set = new Set();
      for (let a = 0; a < n; a++) for (let c = 0; c < n; c++) set.add(a + ',' + c);
      cells(g, Math.round(sx / CELL) * CELL, Math.round(sy / CELL) * CELL, set, (a, c) => SMOKE[(a + c + i) % 2 && step > 1 ? 1 : 0]);
    }
  }
}
