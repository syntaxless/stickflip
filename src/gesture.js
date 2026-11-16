// Turns one touch stroke (a list of {x, y} points in screen pixels) into
// 'tap', 'circle' (a counter-clockwise loop as seen on screen: the backflip)
// or a trick key from SHAPES below. Every stroke is some trick: the closest
// shape wins, and the plain shapes (straight up or down, down-and-up) map to
// the simple flips, so a rushed stroke still does something.
// DOM-free so it can be unit tested.
//
// Trick shapes are matched against templates, so a rough, quick version of
// a shape on a phone still reads: the stroke and every template are resampled
// to the same number of points, centred and scaled to the same size (keeping
// their proportions and direction), and the closest template wins.

export const TAP_RADIUS = 18; // px of wobble a tap may have
const SAMPLE = 32; // points each stroke is resampled to

// A loop has to go at least this far round (radians, about 260 degrees) to
// count as a circle, so a U-shaped shove-it (about 180) never does.
export const CIRCLE_TURN = Math.PI * 1.45;

const mirror = (pts) => pts.map(([x, y]) => [-x, y]);

// Template shapes in screen directions (x right, y down), from the centre of
// a circle of radius 1. The skater rides to the right, so "right" is forward.
// Mirrored pairs share a line. Inspired by the classic flick-gesture charts.
const KICK = [[0, 0], [0, 1], [0.6, -1]];
const SHOVE = [[0, 0], [0, 0.7], [0.35, 0.65], [0.6, 0.4], [0.7, 0], [0.7, -0.6]];
const SHOVE360 = [[0, 0], [-0.45, 0.45], [-0.1, 0.65], [0.3, 0.55], [0.6, 0.3], [0.8, 0]];
const VARIAL = [[0, 0], [-0.4, 0.6], [0.7, -0.6]];
const HARD = [[0.1, 0], [-0.15, 0.7], [0.25, 0.7], [0.35, -0.9]];
const TRE = [[0, 0], [-0.6, 0.1], [-0.45, 0.45], [-0.1, 0.6], [0.6, -0.6]];
const HARD360 = [[0, 0], [0.5, 0.1], [0.4, 0.45], [0, 0.65], [0.3, -0.9]];
export const SHAPES = Object.freeze({
  ollie: [[0, 0], [0, 1], [0, -1]], // down and back up: no trick
  kickflip: KICK,
  heelflip: mirror(KICK),
  shove: SHOVE,
  fsShove: mirror(SHOVE),
  shove360: SHOVE360,
  fsShove360: mirror(SHOVE360),
  varialKick: VARIAL,
  varialHeel: mirror(VARIAL),
  hardflip: HARD,
  inwardHeel: mirror(HARD),
  treflip: TRE,
  laser: mirror(TRE),
  hardflip360: HARD360,
  inward360: mirror(HARD360),
  fs360: [[0, 0], [1, 0]], // a straight swipe forward spins the rider
  bs360: [[0, 0], [-1, 0]], // and backward
  up: [[0, 0], [0, -1]], // straight up or down: no trick
  down: [[0, 0], [0, 1]],
});
// Plain strokes that aren't chart shapes still do the nearest simple trick.
const SIMPLE = { ollie: 'kickflip', down: 'heelflip', up: 'shove' };

function pathLength(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return d;
}

// Evenly spaced points along the path.
function resample(points, n = SAMPLE) {
  const pts = points.map((p) => ({ x: p.x, y: p.y }));
  const step = pathLength(pts) / (n - 1);
  if (!step) return Array.from({ length: n }, () => ({ ...pts[0] }));
  const out = [{ ...pts[0] }];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + d >= step && d > 0) {
      const t = (step - acc) / d;
      const q = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
      out.push(q);
      pts.splice(i, 0, q);
      acc = 0;
    } else acc += d;
  }
  while (out.length < n) out.push({ ...pts[pts.length - 1] });
  return out.slice(0, n);
}

// Centre on the middle of the bounding box and scale the longer side to 1.
function normalize(pts) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const size = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1;
  const cx = (minX + Math.max(...xs)) / 2;
  const cy = (minY + Math.max(...ys)) / 2;
  return pts.map((p) => ({ x: (p.x - cx) / size, y: (p.y - cy) / size }));
}

const prepare = (points) => normalize(resample(points));
const TEMPLATES = Object.entries(SHAPES).map(([key, shape]) => [key, prepare(shape.map(([x, y]) => ({ x, y })))]);

function distance(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return d / a.length;
}

// A counter-clockwise loop: the stroke sweeps most of the way round its own
// middle, staying roughly the same distance from it. Measured around the
// middle rather than by the stroke's heading, so finger wobble doesn't count,
// and flip shapes, which cut through the middle, never pass.
function isLoop(points) {
  const pts = resample(points, 40);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const radii = pts.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
  if (!mean || Math.min(...radii) < mean * 0.3) return false; // passes through the middle
  let sweep = 0;
  let prev = Math.atan2(pts[0].y - cy, pts[0].x - cx);
  for (const p of pts) {
    const h = Math.atan2(p.y - cy, p.x - cx);
    let d = h - prev;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    sweep += d;
    prev = h;
  }
  // Counter-clockwise only (screen y points down, so that's negative): the
  // clockwise loops are the FS shove-its.
  if (sweep > -CIRCLE_TURN) return false;
  if (sweep <= -Math.PI * 1.9) return true; // all the way round (or more): a circle
  // Most of the way: it has to come back round near where it began (the
  // 360 shove-it's wide arc sweeps nearly as far but ends across from its start).
  const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const a = pts[0];
  const b = pts[pts.length - 1];
  return Math.hypot(b.x - a.x, b.y - a.y) <= size * 0.6;
}

// The closest template and how far it is (0 = exact).
export function matchShape(points) {
  const p = prepare(points);
  let best = null;
  let bestD = Infinity;
  for (const [key, t] of TEMPLATES) {
    const d = distance(p, t);
    if (d < bestD) [best, bestD] = [key, d];
  }
  return { key: best, d: bestD };
}

// The full reading, for the debug overlay: what it was read as, the shape it
// matched and how far off it was (0 = exact, about 0.15+ is a rough match).
export function readStroke(points) {
  if (!points.length) return { key: 'tap', shape: 'tap', d: 0 };
  const start = points[0];
  const maxDist = Math.max(...points.map((p) => Math.hypot(p.x - start.x, p.y - start.y)));
  if (maxDist < TAP_RADIUS) return { key: 'tap', shape: 'tap', d: 0 };
  if (isLoop(points)) return { key: 'circle', shape: 'circle', d: 0 };
  const { key, d } = matchShape(points);
  return { key: SIMPLE[key] || key, shape: key, d };
}

export function classifyStroke(points) {
  return readStroke(points).key;
}
