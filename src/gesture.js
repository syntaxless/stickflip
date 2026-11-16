// Turns one touch stroke (a list of {x, y} points in screen pixels) into
// 'tap', a direction ('up' | 'down' | 'left' | 'right') or a two-direction
// pattern like 'down-right', or 'circle' for a counter-clockwise loop (as
// seen on screen). DOM-free so it can be unit tested.

export const TAP_RADIUS = 18; // px of wobble a tap may have
const SEGMENT = 22; // px a stroke must travel before a direction counts

function dirOf(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

// A loop has to turn at least this far (radians) to count as a circle, so a
// curvy two-direction swipe like down-left (about 90 degrees) never does.
export const CIRCLE_TURN = Math.PI * 1.5;

// Total signed turning along the stroke, sampled every SEGMENT px. Screen y
// points down, so clockwise on screen is positive.
function turning(points) {
  const heads = [];
  let anchor = points[0];
  for (const p of points) {
    if (Math.hypot(p.x - anchor.x, p.y - anchor.y) < SEGMENT / 2) continue;
    heads.push(Math.atan2(p.y - anchor.y, p.x - anchor.x));
    anchor = p;
  }
  let total = 0;
  for (let i = 1; i < heads.length; i++) {
    let d = heads[i] - heads[i - 1];
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    total += d;
  }
  return total;
}

export function classifyStroke(points) {
  if (!points.length) return 'tap';
  const start = points[0];
  const maxDist = Math.max(...points.map((p) => Math.hypot(p.x - start.x, p.y - start.y)));
  if (maxDist < TAP_RADIUS) return 'tap';
  if (turning(points) <= -CIRCLE_TURN) return 'circle';

  const dirs = [];
  let anchor = start;
  for (const p of points) {
    const dx = p.x - anchor.x;
    const dy = p.y - anchor.y;
    if (Math.hypot(dx, dy) < SEGMENT) continue;
    const d = dirOf(dx, dy);
    if (dirs[dirs.length - 1] !== d) dirs.push(d);
    anchor = p;
  }
  if (!dirs.length) {
    const last = points[points.length - 1];
    return dirOf(last.x - start.x, last.y - start.y);
  }
  return dirs.length === 1 ? dirs[0] : `${dirs[0]}-${dirs[1]}`;
}
