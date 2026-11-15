// Turns one touch stroke (a list of {x, y} points in screen pixels) into
// 'tap', a direction ('up' | 'down' | 'left' | 'right') or a two-direction
// pattern like 'down-right'. DOM-free so it can be unit tested.

export const TAP_RADIUS = 18; // px of wobble a tap may have
const SEGMENT = 22; // px a stroke must travel before a direction counts

function dirOf(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

export function classifyStroke(points) {
  if (!points.length) return 'tap';
  const start = points[0];
  const maxDist = Math.max(...points.map((p) => Math.hypot(p.x - start.x, p.y - start.y)));
  if (maxDist < TAP_RADIUS) return 'tap';

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
