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
const RIDER_SIZE = 0.72;

// A transform from skater-local world units to framebuffer pixels.
// (x, y) is the anchor in world units, `ang` a rotation in radians.
export function makeTransform(x, y, ang = 0, scale = 1 / 3, size = RIDER_SIZE) {
  const c = Math.cos(ang) * size;
  const s = Math.sin(ang) * size;
  return (p) => ({ x: (x + c * p.x - s * p.y) * scale, y: (y + s * p.x + c * p.y) * scale });
}

const pt = (x, y) => ({ x, y });
// One framebuffer pixel in pose units (the rider is drawn at RIDER_SIZE).
const PX = 3 / RIDER_SIZE;

function poly(g, tf, pts, color) {
  for (let i = 1; i < pts.length; i++) {
    const a = tf(pts[i - 1]);
    const b = tf(pts[i]);
    g.line(a.x, a.y, b.x, b.y, color);
  }
}

// Draws the stick figure (no board) as a black silhouette: 1-pixel limbs,
// a solid round head and a cap.
// `opts.k` scales the cap to the joints' units (1 = pose units); `opts.face` mirrors it
// (-1 = facing left); `opts.tilt` turns it with a tumbling head (the ragdoll).
// `opts.color` draws the limbs and head in another colour with a black outline (the
// rival in Hellride is a pale skeleton), `opts.horns` adds two horns on the head and `opts.noCap` drops the cap and `opts.eyes` adds an eye (black, or `opts.eyeColor`) (`'laugh'` turns the head full face to the player, with a zig zag mouth).
export function drawFigure(g, tf, p, opts = {}) {
  const { k = 1, face = 1, tilt = 0, color = null, horns = null, noCap = false, eyes = false, eyeColor = PAL.ink } = opts;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  // a point on the cap, offset (ox, oy) from the head in pose units
  const cap = (ox, oy) => pt(p.head.x + (ct * ox * face - st * oy) * k, p.head.y + (st * ox * face + ct * oy) * k);
  const body = (t, c) => {
    poly(g, t, [p.footB, p.kneeB, p.hip], c);
    poly(g, t, [p.footF, p.kneeF, p.hip], c);
    poly(g, t, [p.hip, p.neck], c);
    poly(g, t, [p.neck, p.elbowB, p.handB], c);
    poly(g, t, [p.neck, p.elbowF, p.handF], c);
    const h = t(p.head);
    // a slightly bigger head: two r=3 discs offset by one pixel make an 8x8 blob (7px before)
    for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) g.circle(h.x + ox - 1, h.y + oy - 1, 3, c, true);
  };
  if (color) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1]]) {
      body((q) => {
        const r = tf(q);
        return { x: r.x + dx, y: r.y + dy };
      }, PAL.ink);
    }
    body(tf, color);
  } else body(tf, PAL.ink);
  // cap: crown + peak, following the body's rotation (`opts.noCap` leaves a bare head)
  if (!noCap) {
    poly(g, tf, [cap(-9, -7), cap(9, -7)], PAL.ink);
    poly(g, tf, [cap(-7, -10), cap(7, -10)], PAL.ink);
    poly(g, tf, [cap(6, -4), cap(17 + PX, -4)], PAL.ink); // the peak, one pixel longer
  }
  if (eyes) {
    // a profile head shows one black eye at the front; `eyes: 'laugh'` turns it to look back over
    // the shoulder, with a zig zag mouth
    if (eyes === 'laugh') {
      // looking back at the player: the head turns full face, two eyes and a wide zig zag mouth
      // (screen-space pixels on the 8x8 head, whose top left is (hx - 4, hy - 4))
      const h = tf(p.head);
      const hx = Math.round(h.x);
      const hy = Math.round(h.y);
      for (const ex of [-2, 1]) g.pset(hx + ex, hy - 2, eyeColor);
      for (let i = 0; i < 6; i++) g.pset(hx - 3 + i, hy + (i % 2 ? 2 : 1), PAL.ink);
    } else {
      // a profile head shows one black eye at the front
      const e = tf(cap(1.5 * PX, -0.5 * PX));
      g.pset(Math.round(e.x), Math.round(e.y), eyeColor);
    }
  }
  if (horns) {
    // two chunky horns curving out of the top of the head (screen-space sprites, mirrored about the head's
    // middle): red pixels inside a black outline. The head is an 8x8 blob whose top left is (hx - 4, hy - 4).
    const h = tf(p.head);
    const hx = Math.round(h.x);
    const hy = Math.round(h.y);
    const left = [[-3, -5], [-2, -5], [-4, -6], [-3, -6], [-4, -7], [-3, -7], [-5, -8], [-4, -8]];
    const px = [];
    for (const [x, y] of left) px.push([hx + x, hy + y], [hx - 1 - x, hy + y]);
    for (const [x, y] of px) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) g.pset(x + dx, y + dy, PAL.ink);
    for (const [x, y] of px) g.pset(x, y, horns);
  }
}

// Draws the board at the contact point. `spin` is the kickflip angle
// (0 = grip side up); seen side-on, so mid-flip it shows its width.
// `wheels` false draws a snow skate instead (Frostbite): a thicker flat deck with upturned tips that sits
// on the snow, no trucks and no wheels. The same poses, flips and spins.
export function drawBoard(g, tf, spin = 0, lift = 0, deck = PAL.deck, wheels = true, wheelColor = PAL.wheel) {
  const c = Math.cos(spin);
  const thick = Math.abs(Math.sin(spin)) * 18;
  const y = -8 - lift;
  if (thick > 4) {
    // Mid-flip the board shows a face: the grip tape (black inside a brown
    // edge) on one half of the roll, the bottom (all brown, with the four
    // wheels) on the other.
    const t = thick / 2;
    const bottom = Math.sin(spin) > 0;
    for (let o = -t; o <= t; o += 1.5) poly(g, tf, [pt(-26, y + o), pt(26, y + o)], bottom ? deck : PAL.ink);
    poly(g, tf, [pt(-26, y - t), pt(26, y - t), pt(26, y + t), pt(-26, y + t), pt(-26, y - t)], deck);
    if (bottom && wheels) {
      for (const wx of [-16, 16]) {
        for (const wo of [-t + 2, t - 2]) {
          const w = tf(pt(wx, y + wo));
          g.pset(w.x, w.y, wheelColor);
        }
      }
    }
    return;
  }
  poly(g, tf, [pt(-30, y - 5 * c), pt(-22, y), pt(22, y), pt(30, y - 5 * c)], deck);
  if (!wheels) {
    // the snow skate: the deck is thick and comes down to the snow (where the wheels would have been)
    for (const o of [2.5, 5]) poly(g, tf, [pt(-22, y + o * c), pt(22, y + o * c)], deck);
    return;
  }
  // Wheels: 2x2 blocks under the trucks (on top when the board is upside down).
  for (const wx of [-16, 16]) {
    const w = tf(pt(wx, y + 5 * c));
    g.fill(Math.round(w.x) - 1, Math.round(w.y) - (c < 0 ? 0 : 1), 2, 2, wheelColor); // sit on the ground, not in it
  }
}

// Board pitch from vertical speed: nose up while rising, level when falling.
export function boardPitch(vy) {
  return Math.max(-0.35, Math.min(0.12, (vy / PHYS.OLLIE_V) * 0.35));
}
