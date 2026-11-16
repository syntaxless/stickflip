import { PHYS } from '../config.js';

import { PAL } from './pixel.js';

// Key poses in skater-local coordinates: origin at the wheels' contact point,
// x points the way the skater rides, negative y is up. Joints are blended
// toward the target pose every frame so changes read as motion, not snaps.
const J = ['head', 'neck', 'hip', 'kneeB', 'footB', 'kneeF', 'footF', 'elbowB', 'handB', 'elbowF', 'handF'];

const P = (o) => Object.fromEntries(J.map((k) => [k, { x: o[k][0], y: o[k][1] }]));

export const POSES = {
  idle: P({ head: [2, -104], neck: [1, -90], hip: [0, -56], kneeB: [-9, -32], footB: [-12, -9], kneeF: [11, -32], footF: [13, -9], elbowB: [-6, -72], handB: [-8, -57], elbowF: [8, -72], handF: [11, -57] }),
  roll: P({ head: [5, -99], neck: [3, -86], hip: [-1, -51], kneeB: [-8, -30], footB: [-13, -9], kneeF: [14, -31], footF: [14, -9], elbowB: [-14, -70], handB: [-24, -60], elbowF: [16, -72], handF: [27, -64] }),
  crouch: P({ head: [10, -83], neck: [7, -70], hip: [-3, -38], kneeB: [-16, -24], footB: [-13, -9], kneeF: [19, -26], footF: [14, -9], elbowB: [-8, -56], handB: [4, -46], elbowF: [20, -58], handF: [30, -50] }),
  air: P({ head: [4, -102], neck: [2, -89], hip: [0, -52], kneeB: [-16, -36], footB: [-13, -11], kneeF: [18, -38], footF: [14, -11], elbowB: [-20, -78], handB: [-36, -84], elbowF: [22, -80], handF: [38, -88] }),
  flip: P({ head: [4, -110], neck: [2, -97], hip: [0, -62], kneeB: [-20, -48], footB: [-16, -27], kneeF: [22, -50], footF: [18, -29], elbowB: [-22, -88], handB: [-38, -98], elbowF: [22, -88], handF: [40, -100] }),
  charge: P({ head: [12, -70], neck: [9, -58], hip: [-4, -30], kneeB: [-20, -20], footB: [-13, -9], kneeF: [22, -22], footF: [14, -9], elbowB: [-6, -44], handB: [6, -36], elbowF: [22, -46], handF: [32, -40] }),
  prime: P({ head: [6, -90], neck: [4, -77], hip: [-2, -44], kneeB: [-16, -28], footB: [-13, -11], kneeF: [18, -30], footF: [14, -11], elbowB: [-22, -70], handB: [-38, -66], elbowF: [22, -70], handF: [38, -68] }),
  grind: P({ head: [0, -92], neck: [-1, -79], hip: [-3, -45], kneeB: [-14, -27], footB: [-13, -9], kneeF: [16, -29], footF: [14, -9], elbowB: [-24, -72], handB: [-42, -70], elbowF: [22, -74], handF: [40, -76] }),
  bail: P({ head: [14, -96], neck: [10, -82], hip: [0, -50], kneeB: [-20, -36], footB: [-30, -20], kneeF: [16, -30], footF: [24, -14], elbowB: [-6, -96], handB: [-14, -112], elbowF: [26, -92], handF: [36, -106] }),
};

export class PoseBlender {
  constructor(name = 'idle') {
    this.set(name);
  }
  set(name) {
    this.pose = JSON.parse(JSON.stringify(POSES[name])); // deep copy; works on older iOS too
  }
  update(name, dt, rate = 18) {
    const target = POSES[name];
    const k = 1 - Math.exp(-rate * dt);
    for (const j of J) {
      this.pose[j].x += (target[j].x - this.pose[j].x) * k;
      this.pose[j].y += (target[j].y - this.pose[j].y) * k;
    }
  }
}

// How big the rider and board are drawn, relative to their poses (the
// physics doesn't change): smaller, so the screen reads as a place to ride.
export const RIDER_SIZE = 0.72;

// A transform from skater-local world units to framebuffer pixels.
// (x, y) is the anchor in world units, `ang` a rotation in radians.
export function makeTransform(x, y, ang = 0, scale = 1 / 3, size = RIDER_SIZE) {
  const c = Math.cos(ang) * size;
  const s = Math.sin(ang) * size;
  return (p) => ({ x: (x + c * p.x - s * p.y) * scale, y: (y + s * p.x + c * p.y) * scale });
}

const pt = (x, y) => ({ x, y });

function poly(g, tf, pts, color) {
  for (let i = 1; i < pts.length; i++) {
    const a = tf(pts[i - 1]);
    const b = tf(pts[i]);
    g.line(a.x, a.y, b.x, b.y, color);
  }
}

// Draws the stick figure (no board) as a black silhouette: 1-pixel limbs,
// a solid round head and a cap.
export function drawFigure(g, tf, p) {
  const W = PAL.ink;
  poly(g, tf, [p.footB, p.kneeB, p.hip], W);
  poly(g, tf, [p.footF, p.kneeF, p.hip], W);
  poly(g, tf, [p.hip, p.neck], W);
  poly(g, tf, [p.neck, p.elbowB, p.handB], W);
  poly(g, tf, [p.neck, p.elbowF, p.handF], W);
  const h = tf(p.head);
  g.circle(h.x, h.y, 3, W, true);
  // cap: crown + peak, following the body's rotation
  poly(g, tf, [pt(p.head.x - 9, p.head.y - 7), pt(p.head.x + 9, p.head.y - 7)], PAL.ink);
  poly(g, tf, [pt(p.head.x - 7, p.head.y - 10), pt(p.head.x + 7, p.head.y - 10)], PAL.ink);
  poly(g, tf, [pt(p.head.x + 6, p.head.y - 4), pt(p.head.x + 17, p.head.y - 4)], PAL.ink);
}

// Draws the board at the contact point. `spin` is the kickflip angle
// (0 = grip side up); seen side-on, so mid-flip it shows its width.
export function drawBoard(g, tf, spin = 0, lift = 0) {
  const c = Math.cos(spin);
  const thick = Math.abs(Math.sin(spin)) * 18;
  const y = -8 - lift;
  if (thick > 4) {
    // Mid-flip the board shows a face: the grip tape (black inside a brown
    // edge) on one half of the roll, the bottom (all brown, with the four
    // wheels) on the other.
    const t = thick / 2;
    const bottom = Math.sin(spin) > 0;
    for (let o = -t; o <= t; o += 1.5) poly(g, tf, [pt(-26, y + o), pt(26, y + o)], bottom ? PAL.deck : PAL.ink);
    poly(g, tf, [pt(-26, y - t), pt(26, y - t), pt(26, y + t), pt(-26, y + t), pt(-26, y - t)], PAL.deck);
    if (bottom) {
      for (const wx of [-16, 16]) {
        for (const wo of [-t + 2, t - 2]) {
          const w = tf(pt(wx, y + wo));
          g.pset(w.x, w.y, PAL.wheel);
        }
      }
    }
    return;
  }
  poly(g, tf, [pt(-30, y - 5 * c), pt(-22, y), pt(22, y), pt(30, y - 5 * c)], PAL.deck);
  // Wheels: 2x2 blocks under the trucks (on top when the board is upside down).
  for (const wx of [-16, 16]) {
    const w = tf(pt(wx, y + 5 * c));
    g.fill(Math.round(w.x) - 1, Math.round(w.y) - (c < 0 ? 0 : 1), 2, 2, PAL.wheel); // sit on the ground, not in it
  }
}

// Board pitch from vertical speed: nose up while rising, level when falling.
export function boardPitch(vy) {
  return Math.max(-0.35, Math.min(0.12, (vy / PHYS.OLLIE_V) * 0.35));
}
