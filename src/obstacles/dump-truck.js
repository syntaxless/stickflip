import { WORLD } from '../config.js';
import { PAL, Pix } from '../render/pixel.js';

// A dump truck parked on the street, facing right, its bed heaped with gravel.
// The bed's top edge is a grindable rim (like a rail) and its front wall is the
// tallest thing on the truck; the cab is lower, with a flat roof you can land on
// and roll across. Anything else is a slam. Ollie off the street onto the cab, or
// a charged ollie over the whole truck, or grind the rim.
//
// Grind the rim and the truck dumps: the tailgate swings open, the bed tips up
// and the gravel pours out the back into a pile. The dump is only a drawing (the
// rim you ground on is flat in the physics), driven by `fx.dump`: seconds since
// the grind locked, or null while the bed is still full.
const P = (v) => Math.round(v / 3);
const G = WORLD.GROUND;
const { ink, steel, shine, wheel: white } = PAL;

export const TRUCK = Object.freeze({ BED_W: 111, BED_H: 93, CAB_W: 66, CAB_H: 72 });

const BODY = [244, 188, 36];
const BODY_LIT = [255, 228, 112];
const BODY_DARK = [196, 136, 20];
const BODY_DEEP = [128, 84, 12];
const RUST = [150, 82, 40];
const GLASS = [150, 205, 240];
const GLASS_DARK = [96, 150, 205];
const CHASSIS = [44, 44, 52];
const TYRE = [30, 30, 36];
const GRAVEL = [[150, 150, 158], [112, 112, 122], [196, 196, 204], [82, 82, 92]];

const hash = (a, b) => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
};
const smooth = (a, b, v) => {
  const k = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

// The dump, as seconds since the grind locked. The gravel has all gone by 0.8 s.
const TAILGATE_AT = 0.05; // the tailgate starts to swing open
const POUR = [0.15, 0.8]; // gravel leaves the bed (share dumped goes 0 -> 1)
const TIP = [0.25, 0.8]; // the bed tips up
const TIP_MAX = 0.5; // radians (about 29 degrees)
const dumped = (age) => (age === null ? 0 : smooth(POUR[0], POUR[1], age));
const tipAngle = (age) => (age === null ? 0 : TIP_MAX * smooth(TIP[0], TIP[1], age));

// Each piece of gravel in the stream leaves when the share dumped reaches its own number.
const PEBBLES = 150;
const pebbleTime = (i) => {
  const u = (i + 0.5) / PEBBLES;
  let lo = POUR[0];
  let hi = POUR[1];
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2;
    if (smooth(POUR[0], POUR[1], mid) < u) lo = mid;
    else hi = mid;
  }
  return hi;
};
const PEBBLE_AT = Array.from({ length: PEBBLES }, (_, i) => pebbleTime(i));

const PILE_W = 34; // pixels wide behind the truck, and tall at the most
const PILE_H = 15;
const pileTop = (d, share) => {
  // the pile's height `d` pixels out from the tailgate: a mound that grows as it fills
  if (d < 0 || d >= PILE_W) return 0;
  const k = 1 - (d / PILE_W) ** 1.4;
  return Math.round(PILE_H * share * k);
};

// A scratch framebuffer: the bed is drawn into it upright, then turned about its hinge.
function scratch() {
  const rec = Object.create(Pix.prototype);
  rec.ox = 0;
  rec.oy = 0;
  rec.px = new Map();
  rec.pset = (x, y, c) => rec.px.set(`${Math.round(x)},${Math.round(y)}`, c);
  return rec;
}

export function dumpTruck({ x, base = G }) {
  const { BED_W, BED_H, CAB_W, CAB_H } = TRUCK;
  const bedTop = base - BED_H;
  const cabTop = base - CAB_H;
  const rim = { x1: x + 6, x2: x + BED_W, y: bedTop, grindable: true, landable: false, dumps: true };
  const roof = { x1: x + BED_W, x2: x + BED_W + CAB_W, y: cabTop, grindable: false, landable: true };
  return {
    type: 'dump-truck',
    surfaces: [rim, roof],
    solids: [
      { x, y: bedTop, w: BED_W, h: BED_H, slappy: null },
      { x: x + BED_W, y: cabTop, w: CAB_W, h: CAB_H, slappy: null },
    ],
    draw(g, fx = {}) {
      const age = fx.dump ?? null;
      const l = P(x);
      const bedR = P(x + BED_W) - 1;
      const r = P(x + BED_W + CAB_W) - 1;
      const b = P(base) - 1;
      const t = P(bedTop);
      const ct = P(cabTop);
      drawPile(g, l, b, age);
      drawChassis(g, l, bedR, r, b);

      // ---- The bed, drawn upright into a scratch buffer, then tipped about the rear hinge.
      const rec = scratch();
      drawBed(rec, l, bedR, t, b - 10, age);
      const hingeX = l;
      const hingeY = b - 10;
      const th = tipAngle(age);
      if (th === 0) {
        for (const [k, c] of rec.px) {
          const [px, py] = k.split(',').map(Number);
          g.pset(px, py, c);
        }
      } else {
        const [sin, cos] = [Math.sin(th), Math.cos(th)];
        const reach = Math.ceil(Math.hypot(bedR - l + 4, b - t) + 4);
        for (let dy = -reach; dy <= 6; dy++) {
          for (let dx = -8; dx <= reach; dx++) {
            // a destination pixel (dx, dy from the hinge) looks back at the upright bed
            const sx = Math.round(dx * cos - dy * sin);
            const sy = Math.round(dx * sin + dy * cos);
            const c = rec.px.get(`${hingeX + sx},${hingeY + sy}`);
            if (c) g.pset(hingeX + dx, hingeY + dy, c);
          }
        }
        // the hydraulic ram: a steel arm from the chassis up to the tipped bed's belly
        const fx2 = hingeX + 26;
        const bx = hingeX + Math.round(26 * cos + 1 * sin);
        const by = hingeY - Math.round(26 * sin) + 1;
        g.line(fx2, b - 9, bx, by, ink);
        g.line(fx2 + 1, b - 9, bx + 1, by, steel);
      }
      drawTailgate(g, l, t, b - 10, age);
      drawCab(g, bedR + 1, r, ct, b);
      drawWheels(g, l, r, b);
      drawStream(g, l, b, age);
    },
  };
}

function drawChassis(g, l, bedR, r, b) {
  g.fill(l - 1, b - 9, r - l + 2, 3, CHASSIS);
  g.rect(l - 1, b - 10, r - l + 2, 5, ink);
  g.fill(l, b - 9, r - l, 3, CHASSIS);
  g.line(l, b - 9, r - 1, b - 9, [88, 88, 100]);
  // rear bumper bar and a mud flap
  g.fill(l - 3, b - 8, 3, 3, ink);
  g.fill(l - 2, b - 7, 1, 1, [255, 60, 60]);
}

function drawWheels(g, l, r, b) {
  for (const cx of [l + 11, l + 27, r - 9]) {
    const cy = b - 5;
    g.circle(cx, cy, 5, ink, true);
    g.circle(cx, cy, 4, TYRE, true);
    g.circle(cx, cy, 2, steel, true);
    g.pset(cx, cy, shine);
    g.pset(cx - 3, cy - 3, [90, 90, 100]); // a glint on the tread
    g.pset(cx - 4, cy - 1, [90, 90, 100]);
  }
}

// The cab: yellow, with a blue-tinted window and a step, a grille and bumper at the front.
function drawCab(g, cl, r, ct, b) {
  const bot = b - 10;
  g.fill(cl, ct, r - cl + 1, bot - ct + 1, BODY);
  g.line(cl, ct + 1, r - 1, ct + 1, BODY_LIT); // lit roof edge
  g.line(cl, ct + 2, r - 1, ct + 2, BODY_LIT);
  g.fill(cl, ct + 3, 2, bot - ct - 3, BODY_LIT);
  g.fill(r - 3, ct + 3, 3, bot - ct - 3, BODY_DARK);
  g.line(cl, bot - 1, r, bot - 1, BODY_DARK);
  g.line(cl, bot, r, bot, BODY_DEEP);
  // the window, looking forward and to the side: a big pane with a glint
  const wl = cl + 3;
  const wr = r - 6;
  g.fill(wl, ct + 4, wr - wl + 1, 8, GLASS_DARK);
  g.fill(wl + 1, ct + 5, wr - wl - 1, 4, GLASS);
  g.line(wl + 2, ct + 5, wl + 5, ct + 5, white);
  g.rect(wl - 1, ct + 3, wr - wl + 3, 10, ink);
  // a door line and a handle
  g.line(cl + 3, ct + 14, cl + 3, bot - 2, BODY_DARK);
  g.line(r - 8, ct + 14, r - 8, bot - 2, BODY_DARK);
  g.line(cl + 5, ct + 17, cl + 8, ct + 17, steel);
  // grille and headlight at the front, and a chunky bumper
  g.fill(r - 5, ct + 15, 4, 6, [60, 60, 70]);
  g.fill(r - 4, ct + 16, 2, 1, shine);
  g.fill(r - 5, ct + 22, 4, 2, [255, 244, 170]);
  g.fill(r - 2, bot - 4, 4, 4, [70, 70, 80]);
  g.rect(r - 2, bot - 5, 5, 6, ink);
  // outline
  g.rect(cl, ct, r - cl + 1, bot - ct + 1, ink);
  // an exhaust stack beside the cab, behind the bed's front wall, with a puff of smoke
  g.fill(cl + 1, ct - 5, 2, 5, steel);
  g.rect(cl, ct - 6, 4, 7, ink);
  g.pset(cl + 1, ct - 5, shine);
  // rust bleeding down from the roof
  for (const [rx, ry, rl] of [[cl + 10, ct + 3, 3], [cl + 17, ct + 3, 2]]) g.line(rx, ry, rx, ry + rl - 1, RUST);
}

// The bed, upright, into `rec`: its yellow shell, ribs, a hazard stripe and the gravel
// heaped above the rim. `age` is the dump's age, so the heap shrinks as it empties.
function drawBed(rec, l, bedR, t, bot, age) {
  const span = bedR - l;
  // the floor sticks out the back a pixel; the body is a flat yellow with a lit rim
  rec.fill(l, t, span + 1, bot - t + 1, BODY);
  rec.line(l, t, bedR, t, BODY_LIT);
  rec.line(l, t + 1, bedR, t + 1, BODY_LIT); // the rim you grind along
  rec.line(l, t + 2, bedR, t + 2, BODY_DARK);
  rec.fill(l + 1, t + 3, 2, bot - t - 3, BODY_LIT); // lit rear edge
  rec.fill(bedR - 2, t + 3, 2, bot - t - 3, BODY_DARK); // shaded front
  rec.line(l, bot - 1, bedR, bot - 1, BODY_DARK);
  rec.line(l, bot, bedR, bot, BODY_DEEP);
  // vertical ribs, each with a light line beside the dark one
  for (let rx = l + 10; rx < bedR - 6; rx += 9) {
    rec.line(rx, t + 3, rx, bot - 2, BODY_DARK);
    rec.line(rx + 1, t + 3, rx + 1, bot - 2, BODY_LIT);
  }
  // a hazard stripe along the lower body: dark diagonals on yellow
  for (let hx = l + 3; hx < bedR - 3; hx++) {
    if ((hx >> 1) % 2 === 0) {
      rec.pset(hx, bot - 5, ink);
      rec.pset(hx, bot - 4, ink);
    }
  }
  // dents and rust
  for (const [dx, dy, dw] of [[l + 14, t + 8, 5], [bedR - 18, t + 14, 6]]) {
    rec.line(dx, dy, dx + dw - 1, dy, BODY_DARK);
    rec.line(dx + 1, dy + 1, dx + dw - 1, dy + 1, BODY_DARK);
    rec.line(dx, dy + 2, dx + dw - 2, dy + 2, BODY_LIT);
  }
  for (const [rx, ry, rl] of [[l + 7, t + 3, 6], [l + 20, t + 3, 4], [bedR - 9, t + 3, 7], [bedR - 24, t + 3, 3]]) {
    rec.line(rx, ry, rx, ry + rl - 1, RUST);
    rec.pset(rx + 1, ry + 2, RUST);
  }
  // a number plate on the side
  rec.fill(l + 24, t + 10, 12, 5, [236, 200, 60]);
  rec.rect(l + 24, t + 10, 12, 5, ink);
  rec.line(l + 26, t + 12, l + 34, t + 12, BODY_DARK);
  rec.rect(l, t, span + 1, bot - t + 1, ink);
  // the front wall (the headboard) stands a little taller than the rim, over the cab
  rec.fill(bedR - 3, t - 3, 4, 3, BODY);
  rec.line(bedR - 3, t - 3, bedR, t - 3, BODY_LIT);
  rec.rect(bedR - 4, t - 4, 5, 5, ink);
  rec.fill(bedR - 3, t - 3, 4, 4, BODY);
  rec.line(bedR - 3, t - 3, bedR - 1, t - 3, BODY_LIT);
  // gravel heaped over the rim: a lumpy mound that thins as the bed empties
  const left = 1 - dumped(age);
  const peak = Math.round(6 * left);
  if (peak > 0 || age === null) {
    for (let gx = l + 2; gx <= bedR - 3; gx++) {
      const u = (gx - l) / span;
      const lump = hash(gx, 5) % 3;
      const hh = Math.max(0, Math.round(peak * (0.55 + 0.45 * Math.sin(Math.PI * u)) + (lump - 1) * (peak > 1 ? 1 : 0)));
      for (let k = 0; k < hh; k++) {
        const top = k === hh - 1;
        rec.pset(gx, t - 1 - k, top ? ink : GRAVEL[hash(gx, k) % GRAVEL.length]);
      }
    }
    // a few bright pebbles on top
    for (let gx = l + 5; gx < bedR - 5; gx += 6) if (peak > 2) rec.pset(gx + (hash(gx, 1) % 3), t - 2 - (hash(gx, 2) % 2), GRAVEL[2]);
  }
}
// The tailgate: a panel hinged at the top rear corner of the bed. Closed it is
// just the rear edge; open, it swings out and up.
function drawTailgate(g, l, t, bot, age) {
  if (age === null || age < TAILGATE_AT) return;
  const open = smooth(TAILGATE_AT, TAILGATE_AT + 0.2, age);
  const th = tipAngle(age);
  // hinge: the top rear corner, carried round with the bed as it tips about the rear foot
  const h = bot - t;
  const tx = l + Math.round(-h * Math.sin(th));
  const ty = bot - Math.round(h * Math.cos(th));
  const len = h - 4;
  const ang = open * 0.55; // how far the panel hangs out from straight down (it swings, then dangles)
  const ex = tx - Math.round(Math.sin(ang) * len);
  const ey = ty + Math.round(Math.cos(ang) * len);
  g.line(tx - 1, ty, ex - 1, ey, ink);
  g.line(tx, ty, ex, ey, BODY_DARK);
  g.line(tx + 1, ty, ex + 1, ey, ink);
}

// Gravel in the air and the pile it builds behind the truck. Everything follows
// from `age`, so the same age always draws the same picture.
function drawStream(g, l, b, age) {
  if (age === null) return;
  const GRAV = 800; // px/s^2
  for (let i = 0; i < PEBBLES; i++) {
    const t = age - PEBBLE_AT[i];
    if (t < 0) continue;
    const u = (hash(i, 3) % 1000) / 1000;
    const v = (hash(i, 4) % 1000) / 1000;
    const vx = -(26 + 105 * u);
    const vy = -10 + 20 * v;
    const px = l - 1 + vx * t;
    const py = b - 13 + vy * t + 0.5 * GRAV * t * t;
    const d = l - 1 - px;
    const surface = b - pileTop(d, dumped(age));
    if (py >= surface) continue; // landed: it is part of the pile now
    g.fill(px, py, 2, i % 2 === 0 ? 2 : 1, GRAVEL[i % GRAVEL.length]); // chunks of gravel, a pixel or two big
    if (i % 3 === 0) g.pset(px + 2, py, ink);
  }
}

function drawPile(g, l, b, age) {
  if (age === null) return;
  const share = dumped(age);
  if (share <= 0) return;
  for (let d = 0; d < PILE_W; d++) {
    const h = pileTop(d, share);
    if (h <= 0) continue;
    const px = l - 1 - d;
    for (let k = 0; k < h; k++) {
      const edge = k === h - 1 || d === PILE_W - 1;
      g.pset(px, b - k, edge ? ink : GRAVEL[hash(px, k) % GRAVEL.length]);
    }
    if (h > 1) g.pset(px, b - h + 2, GRAVEL[2]); // a light pebble under the outline
  }
  g.line(l - PILE_W, b + 1, l - 1, b + 1, ink); // where it spills out over the curb line
}
