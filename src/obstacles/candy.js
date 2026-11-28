import { gap } from './gap.js';
import { rail } from './rail.js';
import { P, G, ink, hash, POOL_DEPTH } from './art.js';

// Candy Land (Stage 11): ground laid out from a hand-drawn sketch (raised platforms, stairs, two big pits and
// rolling hills), candy cane rails, sticky caramel and conveyor belts, spinning lollipops, the giant gumball that
// chases you, and the animated candy machine at the end. Everything is chunky shaded pixel art with a black outline.
// World units / 3 = pixels (P), as everywhere.

export const CANDY = {
  pink: [255, 128, 176],
  pinkLit: [255, 196, 220],
  pinkDark: [200, 64, 120],
  red: [228, 40, 72],
  redDark: [150, 20, 50],
  white: [255, 250, 246],
  cream: [255, 236, 214],
  mint: [118, 226, 188],
  mintDark: [64, 160, 132],
  yellow: [255, 218, 84],
  orange: [255, 158, 66],
  blue: [104, 184, 255],
  blueDark: [56, 120, 210],
  purple: [166, 112, 224],
  purpleDark: [96, 60, 150],
  choc: [112, 66, 48],
  chocDark: [70, 40, 32],
  caramel: [216, 150, 58],
  caramelLit: [252, 198, 104],
  caramelDark: [150, 92, 36],
  abyss: [58, 30, 78],
  abyssLit: [96, 52, 116],
  glass: [214, 240, 255],
};
const SPRINKLES = [CANDY.pink, CANDY.mint, CANDY.yellow, CANDY.blue, CANDY.orange, CANDY.purple, CANDY.red, CANDY.white];

// ---------------------------------------------------------------- ground

// The strip's ground, laid out as a list of pieces in the section's own coordinates. `h` is a height above the
// street line. flat: [x1, x2, h]; ramp: [x1, x2, h1, h2] (a straight slope: up is a kicker); pit: [x1, x2] (no
// ground at all: ollie over it). Neighbouring pieces must meet at the same height (a step is a wall going up
// and a drop going down). Raised ground is drawn as solid earth, so a pit is only the gap between two walls.
export function terrain(pieces) {
  const ground = [];
  const pits = [];
  for (const [kind, x1, x2, a, b] of pieces) {
    if (kind === 'flat') ground.push({ x1, x2, y: G - a, landable: true });
    else if (kind === 'ramp') ground.push({ x1, x2, y1: G - a, y2: G - b, landable: true });
    else if (kind === 'pit') {
      ground.push(...gap({ x: x1, width: x2 - x1 }).ground);
      pits.push({ x1, x2 });
    }
  }
  const heightAt = (x) => {
    const seg = ground.find((s) => x >= s.x1 && x < s.x2 && s.y !== G + 10000);
    if (!seg) return G;
    return seg.y1 === undefined ? seg.y : seg.y1 + ((seg.y2 - seg.y1) * (x - seg.x1)) / (seg.x2 - seg.x1);
  };
  const lips = pits.map((p) => ({ ...p, top: Math.min(heightAt(p.x1 - 1), heightAt(p.x2 + 1)) }));
  return {
    type: 'candy-ground',
    surfaces: [],
    solids: [],
    ground,
    // The pits are drawn as a deep plum chasm with twinkles, from the lower lip down to the street's own depth.
    draw(g, fx = {}) {
      for (const p of lips) {
        const [l, r] = [P(p.x1), P(p.x2) - 1];
        const top = P(p.top);
        const bottom = P(G) + POOL_DEPTH;
        for (let x = l; x <= r; x++) {
          for (let y = top; y < bottom; y++) {
            const d = y - top;
            const c = d < 3 ? CANDY.abyssLit : (hash(x >> 1, y >> 1) % 7 === 0 ? CANDY.abyssLit : CANDY.abyss);
            g.pset(x, y, c);
          }
        }
        // sugar crystals sparkling in the dark
        for (let i = 0; i < 7; i++) {
          const sx = l + 3 + (hash(p.x1, i) % Math.max(1, r - l - 5));
          const sy = top + 8 + (hash(p.x2, i + 9) % Math.max(1, bottom - top - 12));
          if (Math.floor((fx.time || 0) * 2 + i) % 3 === 0) {
            g.pset(sx, sy, CANDY.white);
            g.pset(sx - 1, sy, CANDY.pinkLit);
            g.pset(sx + 1, sy, CANDY.pinkLit);
            g.pset(sx, sy - 1, CANDY.pinkLit);
            g.pset(sx, sy + 1, CANDY.pinkLit);
          }
        }
      }
    },
  };
}

// ----------------------------------------------------------------- rails

// A candy cane stripe along a line: lit top row, striped body row (red and white, in fixed spots along the rail) and
// a black underside, so it reads like the other rails but is plainly a cane. Never highlighted for timing.
function cane(g, x1, y1, x2, y2) {
  const n = Math.max(1, Math.abs(x2 - x1));
  const dir = x2 >= x1 ? 1 : -1;
  for (let i = 0; i <= n; i++) {
    const px = x1 + i * dir;
    const py = Math.round(y1 + ((y2 - y1) * i) / n);
    const red = Math.floor(i / 4) % 2 === 0;
    g.pset(px, py, red ? CANDY.pinkLit : CANDY.white);
    g.pset(px, py + 1, red ? CANDY.red : CANDY.white);
    g.pset(px, py + 2, ink);
  }
}

// A lollipop-stick post: a white stick with a pink stripe, a black outline and a gumdrop foot.
function stick(g, x, y1, y2, foot = CANDY.mint) {
  g.line(x - 1, y1, x - 1, y2, ink);
  g.line(x + 1, y1, x + 1, y2, ink);
  g.line(x, y1, x, y2, CANDY.white);
  for (let y = y1 + 2; y < y2; y += 6) g.pset(x, y, CANDY.pink);
  g.fill(x - 3, y2 - 2, 7, 3, foot);
  g.rect(x - 3, y2 - 2, 7, 3, ink);
  g.pset(x - 2, y2 - 1, CANDY.white);
}

// A flat (or rainbow-arched) candy cane rail on lollipop sticks. Same physics as any rail.
export function caneRail({ x, length, height, base = G, arc = 0, feet = null }) {
  const body = rail({ x, length, height, base, arc });
  const top = base - height;
  const yAt = (px) => top - arc * 4 * ((px - x) / length) * (1 - (px - x) / length);
  return {
    ...body,
    type: 'cane-rail',
    draw(g) {
      const ground = P(base);
      // `feet`: [[x, ground height]] for posts that stand somewhere other than the rail's own street (over a pit's lips)
      const posts = feet || (arc ? [x + 22, x + length / 2, x + length - 22] : [x + 22, x + length - 22]).map((wx) => [wx, base === G ? 0 : G - base]);
      posts.forEach(([wx, fh], i) => stick(g, P(wx), P(yAt(wx)) + 3, (feet ? P(G - fh) : ground) - 1, [CANDY.mint, CANDY.yellow, CANDY.blue][i % 3]));
      const n = arc ? 24 : 1;
      for (let i = 0; i < n; i++) {
        const [ax, bx] = [x + (length * i) / n, x + (length * (i + 1)) / n];
        cane(g, P(ax), P(yAt(ax)), P(bx), P(yAt(bx)));
      }
    },
  };
}

// A sloped candy cane rail (a handrail down some steps, or a rail up a hill) from (x1, y1) to (x2, y2) in world
// units, on sticks that reach down to `feet` ([[x, groundY], ...]). Beside the steps: you pass it unless you
// tap to grind it (`passable`), like a stairs handrail.
export function caneSlope({ x1, y1, x2, y2, feet = [], passable = false }) {
  const surface = { x1, x2, y1, y2, grindable: true, landable: false, ...(passable && { passable: true }) };
  return {
    type: 'cane-slope',
    surfaces: [surface],
    solids: [],
    draw(g) {
      feet.forEach(([fx, fy], i) => {
        const ry = y1 + ((y2 - y1) * (fx - x1)) / (x2 - x1);
        stick(g, P(fx), P(ry) + 3, P(fy) - 1, [CANDY.mint, CANDY.yellow, CANDY.blue][i % 3]);
      });
      cane(g, P(x1), P(y1), P(x2), P(y2));
    },
  };
}

// ----------------------------------------------------------------- blocks

// A gumdrop block you can land on and roll across (a "box"): a squat sugar-coated cube with sprinkles.
export function gumdropBlock({ x, w, h, base = G, color = 0 }) {
  const top = base - h;
  const surface = { x1: x, x2: x + w, y: top, landable: true, grindable: false };
  const tint = [[CANDY.pink, CANDY.pinkLit, CANDY.pinkDark], [CANDY.mint, CANDY.white, CANDY.mintDark], [CANDY.yellow, CANDY.white, CANDY.orange]][color % 3];
  return {
    type: 'gumdrop-block',
    surfaces: [surface],
    solids: [{ x, y: top, w, h }],
    draw(g) {
      const [l, t, r, b] = [P(x), P(top), P(x + w) - 1, P(base) - 1];
      g.fill(l, t, r - l + 1, b - t + 1, tint[0]);
      g.rect(l, t, r - l + 1, b - t + 1, ink);
      g.line(l + 1, t + 1, r - 1, t + 1, tint[1]);
      g.line(l + 1, t + 2, Math.min(r - 1, l + 6), t + 2, tint[1]);
      g.line(l + 1, b - 1, r - 1, b - 1, tint[2]);
      for (let i = 0; i < 6; i++) {
        const sx = l + 3 + (hash(x, i) % Math.max(1, r - l - 5));
        const sy = t + 4 + (hash(x + 7, i) % Math.max(1, b - t - 6));
        g.fill(sx, sy, 2, 1, SPRINKLES[(i + color) % SPRINKLES.length]);
      }
    },
  };
}

// ----------------------------------------------------- belts (and goo)

// A strip of the street that carries you: a conveyor (v > 0, speeds you up) or sticky caramel (v < 0, slows you
// down). Ollie over it or grind past it and it does nothing. Only the street is affected, not rails or the air.
// It lies on flat ground at height `h`.
export function belt({ x, w, v, h = 0, goo = false }) {
  const y = G - h;
  return {
    type: goo ? 'goo' : 'belt',
    surfaces: [],
    solids: [],
    belts: [{ x1: x, x2: x + w, v }],
    draw(g, fx = {}) {
      const [l, r, top] = [P(x), P(x + w) - 1, P(y)];
      const t = fx.time || 0;
      if (goo) {
        // a puddle of caramel: a lit rim, bubbles that rise and pop, a dark foot line
        for (let px = l; px <= r; px++) {
          const edge = Math.min(px - l, r - px);
          const hgt = edge < 3 ? edge + 1 : 4;
          g.fill(px, top - hgt, 1, hgt + 1, CANDY.caramel);
          g.pset(px, top - hgt, ink);
          if (edge >= 3) g.pset(px, top - hgt + 1, CANDY.caramelLit);
        }
        g.fill(l + 1, top, r - l - 1, 1, CANDY.caramelDark);
        for (let i = 0; i < 4; i++) {
          const bx = l + 6 + ((hash(x, i) % Math.max(1, r - l - 12)));
          const ph = ((t * 0.9 + i * 0.37) % 1);
          if (ph < 0.8) g.pset(bx, top - 1 - Math.round(ph * 4), CANDY.caramelLit);
        }
        return;
      }
      // a conveyor: a dark rubber belt with chevrons sliding along it and a roller at each end
      g.fill(l, top - 2, r - l + 1, 3, ink);
      g.fill(l + 1, top - 2, r - l - 1, 2, CANDY.blueDark);
      const shift = Math.floor(t * (v / 3) * 0.5);
      for (let px = l + 2; px < r - 1; px += 1) {
        const k = (((px - shift) % 10) + 10) % 10;
        if (k === 0 || k === 1) g.pset(px, top - 2, CANDY.yellow);
      }
      for (const rx of [l + 1, r - 1]) {
        g.circle(rx, top - 1, 2, ink, true);
        g.pset(rx, top - 2, CANDY.white);
      }
    },
  };
}

// ----------------------------------------------------------- spinners

// A spinning lollipop bar: a long arm turning about a pivot, with a lollipop on each end. Time it: slow down
// or speed up so the arms are out of the way as you go through. `cy` is the pivot's height over `base`.
// (The hit test is in Game.checkSpinners; the angle is `phase + w * game time`.)
export function spinner({ x, cy = 92, r = 74, w = 2.2, phase = 0, base = G }) {
  const spin = { x, cy: base - cy, r, w, phase };
  return {
    type: 'spinner',
    surfaces: [],
    solids: [],
    hazards: [{ x, spin, reason: 'slam' }],
    draw(g, fx = {}) {
      const t = fx.gameTime ?? fx.time ?? 0;
      const [px, py, pr] = [P(x), P(base - cy), P(r)];
      // the axle: a post up from the street to the hub
      g.line(px, py, px, P(base) - 1, ink);
      g.line(px - 1, py + 2, px - 1, P(base) - 1, ink);
      g.line(px + 1, py + 2, px + 1, P(base) - 1, ink);
      g.line(px, py + 2, px, P(base) - 2, CANDY.white);
      g.fill(px - 4, P(base) - 3, 9, 3, CANDY.purple);
      g.rect(px - 4, P(base) - 3, 9, 3, ink);
      const a = phase + w * t;
      for (let k = 0; k < 2; k++) {
        const th = a + k * Math.PI;
        const tx = px + Math.round(Math.cos(th) * pr);
        const ty = py + Math.round(Math.sin(th) * pr);
        // the arm: a striped stick
        const n = Math.max(Math.abs(tx - px), Math.abs(ty - py));
        for (let i = 0; i <= n; i++) {
          const ax = px + Math.round(((tx - px) * i) / n);
          const ay = py + Math.round(((ty - py) * i) / n);
          g.pset(ax, ay, Math.floor(i / 4) % 2 ? CANDY.pink : CANDY.white);
          g.pset(ax + 1, ay, ink);
          g.pset(ax - 1, ay, ink);
          g.pset(ax, ay + 1, ink);
          g.pset(ax, ay - 1, ink);
        }
        for (let i = 0; i <= n; i++) {
          const ax = px + Math.round(((tx - px) * i) / n);
          const ay = py + Math.round(((ty - py) * i) / n);
          g.pset(ax, ay, Math.floor(i / 4) % 2 ? CANDY.pink : CANDY.white);
        }
        // the lollipop: a swirled disc
        swirl(g, tx, ty, 6, a * 2 + k, k ? [CANDY.blue, CANDY.white] : [CANDY.red, CANDY.white]);
      }
      g.circle(px, py, 3, ink, true);
      g.circle(px, py, 2, CANDY.yellow, true);
      g.pset(px - 1, py - 1, CANDY.white);
    },
  };
}

// A round candy with a spiral: a black outline, two colours turning about the centre.
function swirl(g, cx, cy, r, rot, [c1, c2]) {
  for (let dy = -r - 1; dy <= r + 1; dy++) {
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > r + 0.5) continue;
      if (d > r - 0.7) {
        g.pset(cx + dx, cy + dy, ink);
        continue;
      }
      const ang = Math.atan2(dy, dx) + rot + d * 0.55;
      g.pset(cx + dx, cy + dy, Math.sin(ang * 2) > 0 ? c1 : c2);
    }
  }
}

// --------------------------------------------------------------- gumball

// The giant gumball: a shaded pink ball with a black outline, swirled stripes that turn as it rolls (`rot`) and a
// shine. (cx, cy) is the centre and r the radius, in pixels.
export function drawGumball(g, cx, cy, r, rot = 0, tint = 0, angry = false) {
  const [base, lit, dark] = [[CANDY.pink, CANDY.pinkLit, CANDY.pinkDark], [CANDY.blue, [200, 232, 255], CANDY.blueDark]][tint % 2];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > r + 0.3) continue;
      if (d > r - 1) {
        g.pset(cx + dx, cy + dy, ink);
        continue;
      }
      // light from the top left: a lit crescent, a dark crescent bottom right
      const shade = (dx * -0.55 + dy * -0.75) / r;
      let c = shade > 0.55 ? lit : shade < -0.5 ? dark : base;
      // three swirled stripes that turn with the roll
      const ang = Math.atan2(dy, dx) + rot;
      const arm = Math.sin(ang * 3 + d * 0.12);
      if (arm > 0.88 && d > 4) c = shade < -0.5 ? base : lit;
      g.pset(cx + dx, cy + dy, c);
    }
  }
  // the shine
  for (const [sx, sy] of [[-0.5, -0.55], [-0.42, -0.62], [-0.58, -0.45], [-0.5, -0.47]]) g.pset(cx + Math.round(sx * r), cy + Math.round(sy * r), CANDY.white);
  g.fill(cx - Math.round(r * 0.55), cy - Math.round(r * 0.62), 3, 2, CANDY.white);
  if (angry) angryFace(g, cx, cy, r);
}

// The chasing gumball's face (it does not turn with the ball): two glaring eyes with heavy brows slanting in, and a
// wide zigzag mouth of teeth, all on the side that faces you.
function angryFace(g, cx, cy, r) {
  const u = Math.max(1, Math.round(r / 14));
  const fx = cx + Math.round(r * 0.3);
  for (const [ex, sg] of [[fx - 3 * u, 1], [fx + 4 * u, -1]]) {
    const ey = cy - Math.round(r * 0.18);
    g.fill(ex - u, ey - u, 3 * u, 2 * u, CANDY.white);
    g.rect(ex - u, ey - u, 3 * u, 2 * u, ink);
    g.fill(ex + (sg > 0 ? u : 0), ey, u, u, [230, 20, 40]);
    // the brow: slants down towards the middle
    for (let i = -2 * u; i <= 2 * u; i++) g.fill(ex + i, ey - 2 * u - 1 + Math.round(sg * (i / 2)), 1, u + 1, ink);
  }
  const my = cy + Math.round(r * 0.3);
  const mw = 5 * u;
  g.fill(fx - mw, my - u, mw * 2 + 1, 4 * u, ink);
  for (let i = -mw + 1; i < mw; i += 2 * u) {
    g.fill(i + fx, my - u + 1, u + 1, 2 * u, CANDY.white); // top teeth
    g.fill(i + fx + u, my + u, u + 1, 2 * u - 1, CANDY.white); // bottom teeth
  }
}

// ------------------------------------------------------------ the machine

const CONFETTI = [CANDY.pink, CANDY.mint, CANDY.yellow, CANDY.blue, CANDY.orange, CANDY.purple, CANDY.white, CANDY.red];

// The giant candy machine that ends the stage. A glass globe full of gumballs sits on a red base with a coin slot,
// a crank and two lollipop gears that never stop turning; at the foot of the base the dispenser mouth is the finish:
// ride in on the conveyor and out pops a giant gumball, with confetti from the top. `fx.done` is the seconds since
// the finish (null until then). `x` is the machine's left edge in world units.
export function candyMachine({ x }) {
  return {
    type: 'candy-machine',
    surfaces: [],
    solids: [],
    belts: [{ x1: x + 130, x2: x + 520, v: 70 }],
    draw(g, fx = {}) {
      const t = fx.time || 0;
      const l = P(x); // left edge in pixels
      const street = P(G);
      const w = 176;
      const cx = l + (w >> 1);
      // -- the base: a red cabinet with a lit edge and a darker foot
      const baseTop = street - 52;
      g.fill(l + 8, baseTop, w - 16, 52, CANDY.red);
      g.rect(l + 8, baseTop, w - 16, 52, ink);
      g.line(l + 9, baseTop + 1, l + w - 10, baseTop + 1, CANDY.pinkLit);
      g.line(l + 9, baseTop + 2, l + w - 10, baseTop + 2, CANDY.pink);
      g.fill(l + 9, street - 4, w - 18, 3, CANDY.redDark);
      // polka dots and stripes on the cabinet
      for (let i = 0; i < 9; i++) g.fill(l + 14 + i * 18, baseTop + 6, 8, 3, i % 2 ? CANDY.white : CANDY.yellow);
      // -- the neck and the globe's cap
      g.fill(cx - 38, baseTop - 8, 76, 8, CANDY.pinkDark);
      g.rect(cx - 38, baseTop - 8, 76, 9, ink);
      g.line(cx - 37, baseTop - 7, cx + 36, baseTop - 7, CANDY.pinkLit);
      // -- the globe: glass with gumballs swirling inside
      const gr = 38;
      const gy = baseTop - 8 - gr + 6;
      g.circle(cx, gy, gr + 1, ink, true);
      g.circle(cx, gy, gr, CANDY.glass, true);
      for (let i = 0; i < 26; i++) {
        const ring = 6 + (hash(i, 3) % 24);
        const sp = (0.25 + (hash(i, 5) % 10) / 20) * (i % 2 ? 1 : -1);
        const a = (hash(i, 7) % 628) / 100 + t * sp;
        const bx = cx + Math.round(Math.cos(a) * ring * 0.95);
        const by = gy + 6 + Math.round(Math.sin(a) * ring * 0.8);
        if (Math.hypot(bx - cx, by - gy) > gr - 5) continue;
        const c = SPRINKLES[i % 6];
        g.circle(bx, by, 4, ink, true);
        g.circle(bx, by, 3, c, true);
        g.pset(bx - 1, by - 1, CANDY.white);
      }
      // glass shine
      for (let i = 0; i < 14; i++) g.pset(cx - 30 + Math.round(i * 0.55), gy - 22 + Math.round(i * 1.1), CANDY.white);
      g.line(cx - 33, gy - 14, cx - 27, gy - 24, CANDY.white);
      // the lid and knob on top
      g.fill(cx - 14, gy - gr - 7, 28, 7, CANDY.red);
      g.rect(cx - 14, gy - gr - 7, 28, 8, ink);
      g.line(cx - 13, gy - gr - 6, cx + 12, gy - gr - 6, CANDY.pinkLit);
      g.circle(cx, gy - gr - 11, 5, ink, true);
      g.circle(cx, gy - gr - 11, 4, CANDY.yellow, true);
      g.pset(cx - 2, gy - gr - 13, CANDY.white);
      // -- the coin slot and crank (on the right of the cabinet)
      g.fill(l + w - 44, baseTop + 14, 22, 12, CANDY.yellow);
      g.rect(l + w - 44, baseTop + 14, 22, 12, ink);
      g.fill(l + w - 37, baseTop + 18, 8, 2, ink);
      const ca = t * 1.6;
      const [kx, ky] = [l + w - 33, baseTop + 40];
      g.circle(kx, ky, 6, ink, true);
      g.circle(kx, ky, 5, CANDY.white, true);
      g.line(kx, ky, kx + Math.round(Math.cos(ca) * 9), ky + Math.round(Math.sin(ca) * 9), ink);
      g.circle(kx + Math.round(Math.cos(ca) * 9), ky + Math.round(Math.sin(ca) * 9), 2, CANDY.orange, true);
      // -- a lollipop gear on the cabinet, always turning
      gear(g, l + 24, baseTop + 24, 15, t * 1.1);
      // -- the dispenser mouth at the foot: a dark arch with a frosting scallop, a belt carrying you in
      const mouthL = l + 56;
      const mouthW = 72;
      const mouthTop = street - 34;
      g.fill(mouthL, mouthTop, mouthW, 34, ink);
      for (let px = mouthL + 2; px < mouthL + mouthW - 2; px++) {
        // the inside: a warm glow deepening to the back, with moving stripes (the belt's lights)
        const k = (((px + Math.floor(t * 14)) % 12) + 12) % 12;
        g.line(px, mouthTop + 3, px, street - 4, k < 2 ? CANDY.chocDark : [58, 30, 40]);
      }
      g.rect(mouthL, mouthTop, mouthW, 35, ink);
      for (let px = mouthL; px < mouthL + mouthW; px += 6) {
        g.circle(px + 3, mouthTop, 3, CANDY.white, true);
        g.circle(px + 3, mouthTop, 3, ink);
      }
      for (let px = mouthL; px < mouthL + mouthW; px += 6) g.fill(px + 1, mouthTop - 2, 5, 3, CANDY.cream);
      // -- the payoff: confetti from the top and a giant gumball rolling out of the mouth
      const done = fx.done;
      if (done !== null && done !== undefined) {
        for (let i = 0; i < 90; i++) {
          const born = (hash(i, 1) % 100) / 400;
          const age = done - born;
          if (age < 0 || age > 3.2) continue;
          const ang = -Math.PI / 2 + ((hash(i, 2) % 200) - 100) / 100 * 1.25;
          const sp = 90 + (hash(i, 3) % 140);
          const px = cx + Math.round(Math.cos(ang) * sp * age * 0.5 + Math.sin(age * 7 + i) * 3);
          const py = gy - gr - 8 + Math.round(Math.sin(ang) * sp * age * 0.5 + 70 * age * age);
          if (py < street - 1) g.fill(px, py, 2, 2, CONFETTI[i % CONFETTI.length]);
        }
        const roll = Math.min(done / 0.9, 1);
        const gx = mouthL + 18 + Math.round(roll * (mouthW + 40));
        const bounce = done > 0.9 ? Math.abs(Math.sin((done - 0.9) * 5)) * 10 * Math.exp(-(done - 0.9) * 0.9) : 0;
        drawGumball(g, gx, street - 12 - Math.round(bounce), 11, done * 6, 1);
      }
    },
  };
}

// A cog with lollipops for teeth: a purple hub, spokes and round candies on their ends, turning by `a`.
function gear(g, cx, cy, r, a) {
  const teeth = 8;
  g.circle(cx, cy, r - 3, ink, true);
  g.circle(cx, cy, r - 4, CANDY.purple, true);
  for (let k = 0; k < teeth; k++) {
    const th = a + (k * Math.PI * 2) / teeth;
    const tx = cx + Math.round(Math.cos(th) * (r - 1));
    const ty = cy + Math.round(Math.sin(th) * (r - 1));
    g.line(cx, cy, tx, ty, k % 2 ? CANDY.pinkLit : CANDY.white);
    g.circle(tx, ty, 2, ink, true);
    g.circle(tx, ty, 1, SPRINKLES[k % 6], true);
  }
  g.circle(cx, cy, 2, ink, true);
  g.circle(cx, cy, 1, CANDY.yellow, true);
}
