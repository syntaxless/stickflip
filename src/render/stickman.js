import { PHYS } from '../config.js';

export const INK = '#1b1b1f';

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
  prime: P({ head: [6, -90], neck: [4, -77], hip: [-2, -44], kneeB: [-16, -28], footB: [-13, -11], kneeF: [18, -30], footF: [14, -11], elbowB: [-22, -70], handB: [-38, -66], elbowF: [22, -70], handF: [38, -68] }),
  grind: P({ head: [0, -92], neck: [-1, -79], hip: [-3, -45], kneeB: [-14, -27], footB: [-13, -9], kneeF: [16, -29], footF: [14, -9], elbowB: [-24, -72], handB: [-42, -70], elbowF: [22, -74], handF: [40, -76] }),
  bail: P({ head: [14, -96], neck: [10, -82], hip: [0, -50], kneeB: [-20, -36], footB: [-30, -20], kneeF: [16, -30], footF: [24, -14], elbowB: [-6, -96], handB: [-14, -112], elbowF: [26, -92], handF: [36, -106] }),
};

export class PoseBlender {
  constructor(name = 'idle') {
    this.set(name);
  }
  set(name) {
    this.pose = structuredClone(POSES[name]);
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

function line(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

// Draws the stick figure (no board) in local coordinates.
export function drawFigure(ctx, p) {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5;
  line(ctx, [p.footB, p.kneeB, p.hip]);
  line(ctx, [p.footF, p.kneeF, p.hip]);
  line(ctx, [p.hip, p.neck]);
  line(ctx, [p.neck, p.elbowB, p.handB]);
  line(ctx, [p.neck, p.elbowF, p.handF]);

  // head + cap
  const h = p.head;
  ctx.fillStyle = '#fffaf0';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(h.x, h.y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e4572e';
  ctx.beginPath();
  ctx.arc(h.x, h.y - 2, 11.5, Math.PI * 1.02, Math.PI * 1.98);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(h.x + 4, h.y - 3);
  ctx.lineTo(h.x + 19, h.y - 1);
  ctx.stroke();
  ctx.restore();
}

// Draws the board centred at the contact point. `spin` is the kickflip angle
// (0 = grip side up); the board is seen side-on, so a flip shows its width.
export function drawBoard(ctx, spin = 0) {
  const c = Math.cos(spin);
  const sN = Math.sin(spin);
  const half = 26;
  const deckY = -8;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;

  // wheels sit under the deck when grip side is up, over it when upside down
  const wy = deckY + 5 * c;
  ctx.fillStyle = INK;
  if (Math.abs(c) > 0.15) {
    for (const wx of [-16, 16]) {
      ctx.beginPath();
      ctx.arc(wx, wy, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const thick = Math.abs(sN) * 16;
  if (thick > 2) {
    // deck seen from top or bottom while it rotates
    ctx.fillStyle = sN > 0 ? '#2b2b30' : '#2f8fd8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-half, deckY - thick / 2, half * 2, thick, thick / 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-half - 2, deckY - 4 * c);
    ctx.lineTo(-half + 6, deckY);
    ctx.lineTo(half - 6, deckY);
    ctx.lineTo(half + 2, deckY - 4 * c);
    ctx.stroke();
    ctx.strokeStyle = '#2f8fd8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-half + 7, deckY + 2.5 * c);
    ctx.lineTo(half - 7, deckY + 2.5 * c);
    ctx.stroke();
  }
  ctx.restore();
}

// Board pitch from vertical speed: nose up while rising, level when falling.
export function boardPitch(vy) {
  return Math.max(-0.35, Math.min(0.12, (vy / PHYS.OLLIE_V) * 0.35));
}
