// The bail ragdoll: the stick figure as eleven joints joined by bones (Verlet
// integration, fixed 1/120 s steps, no randomness), so it flops, tumbles, bounces
// off the ground and slides to a stop the same way every time. DOM-free.

import { POSES } from './render/stickman.js';
import { PHYS } from './config.js';

export const RAG_SIZE = 0.72; // the rider is drawn at this share of its pose units
const STEP = 1 / 120;
const ITER = 8;
const REST = 0.55; // how much of its speed a joint keeps (reversed) when it hits the ground
const SLIDE = 0.985; // sideways speed kept per step while a joint drags along the ground
const AIR = 0.9995;

const J = ['head', 'neck', 'hip', 'kneeB', 'footB', 'kneeF', 'footF', 'elbowB', 'handB', 'elbowF', 'handF'];
// Bones (rest lengths come from the standing pose) plus two braces that keep the torso from folding in half.
const BONES = [
  ['neck', 'head'], ['hip', 'neck'], ['hip', 'kneeB'], ['kneeB', 'footB'], ['hip', 'kneeF'], ['kneeF', 'footF'],
  ['neck', 'elbowB'], ['elbowB', 'handB'], ['neck', 'elbowF'], ['elbowF', 'handF'], ['head', 'hip'],
];
const LEN = Object.fromEntries(
  BONES.map(([a, b]) => [a + b, Math.hypot(POSES.air[a].x - POSES.air[b].x, POSES.air[a].y - POSES.air[b].y) * RAG_SIZE]),
);

// `x, y`: the skateboard's contact point; `dir`: the way the rider faces; `vx, vy`: launch
// velocity; `spin`: radians/s about the hip. The arms and legs get an extra flail.
export function createRagdoll(x, y, dir, vx, vy, spin) {
  const pts = {};
  const hip = POSES.bail.hip;
  for (const k of J) {
    const lx = POSES.bail[k].x * dir * RAG_SIZE;
    const ly = POSES.bail[k].y * RAG_SIZE;
    const px = x + lx;
    const py = y + ly;
    const rx = (POSES.bail[k].x - hip.x) * dir * RAG_SIZE;
    const ry = (POSES.bail[k].y - hip.y) * RAG_SIZE;
    // velocity of this joint: the launch plus the turn about the hip (v = w x r) plus a flail on the limbs
    const flail = k.startsWith('hand') || k.startsWith('foot') ? 1 : k.startsWith('knee') || k.startsWith('elbow') ? 0.5 : 0;
    const jx = flail * dir * (k.endsWith('B') ? -90 : 70);
    const jy = flail * (k.endsWith('B') ? 60 : -80);
    const vxk = vx - spin * ry + jx;
    const vyk = vy + spin * rx + jy;
    pts[k] = { x: px, y: py, px: px - vxk * STEP, py: py - vyk * STEP, touch: false };
  }
  return { pts, acc: 0, sq: 0, hit: 0, rest: false, t: 0, dir };
}

// Hip position, and the lowest point (what the camera and the squash sit on).
export const hipOf = (r) => r.pts.hip;

function step(r, floorAt) {
  const { pts } = r;
  for (const k of J) {
    const p = pts[k];
    let vx = (p.x - p.px) * AIR;
    let vy = (p.y - p.py) * AIR;
    if (p.touch) {
      if (vy > 0) {
        const speed = vy / STEP;
        if (speed > 60) {
          vy = -vy * REST;
          if (k === 'hip' || k === 'neck' || k === 'head') r.hit = Math.max(r.hit, Math.min(1, speed / 520));
        } else vy = 0;
      }
      vx *= SLIDE;
      if (Math.abs(vx) / STEP < 4) vx = 0;
    }
    p.px = p.x;
    p.py = p.y;
    p.x += vx;
    p.y += vy + PHYS.GRAVITY * STEP * STEP;
    p.touch = false;
  }
  for (let i = 0; i < ITER; i++) {
    for (const [a, b] of BONES) {
      const A = pts[a];
      const B = pts[b];
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const f = ((d - LEN[a + b]) / d) * 0.5;
      A.x += dx * f;
      A.y += dy * f;
      B.x -= dx * f;
      B.y -= dy * f;
    }
    for (const k of J) {
      const p = pts[k];
      const floor = floorAt(p.x);
      if (p.y >= floor) {
        p.y = floor;
        p.touch = true;
      }
    }
  }
}

// Advance by dt seconds in fixed steps. `floorAt(x)` gives the ground height.
export function stepRagdoll(r, dt, floorAt) {
  r.acc += dt;
  r.t += dt;
  while (r.acc >= STEP) {
    r.acc -= STEP;
    step(r, floorAt);
  }
  // squash on a hard landing, fading over ~0.15 s
  r.sq = Math.max(r.hit, r.sq - dt * 6);
  r.hit = 0;
}

// Squash/stretch in three steps so it still reads as pixel art: { sx, sy } to scale the
// figure by about the lowest joint. A hard landing squashes it; a fast launch stretches it.
export function squashOf(r) {
  const q = r.sq > 0.66 ? 2 : r.sq > 0.25 ? 1 : 0;
  if (q) return { sx: 1 + 0.08 * q, sy: 1 - 0.1 * q };
  const vy = (r.pts.hip.y - r.pts.hip.py) / STEP;
  if (vy < -330 && r.t < 0.5) return { sx: 0.94, sy: 1.1 };
  return { sx: 1, sy: 1 };
}
