// A stage: one long strip of ground the camera pans along, made by laying
// single-screen sections (src/levels/levelN.js) end to end. Each section's
// name is a checkpoint: a bail puts the rider back at the start of the
// section they bailed in, and the stage can be restarted from the top.
//
// A section is laid out on its own 960-wide screen. Here it's shifted along
// to its place in the strip, and ground that ran on forever (a stair top, a
// quarter pipe's deck) is cut at the section's edges.

import { WORLD } from '../config.js';

const SECTION_W = WORLD.W; // a multiple of 3, so sections line up with the pixels

// `extra`: obstacles in strip coordinates that join sections (a bank up to a
// raised start, say). They go first, so their ground wins where they overlap.
// `starts`: { sectionIndex: offset } to spawn a replay at x + offset instead of
// the usual PHYS.START_X; negative reaches back onto the section before.
export function stage({ id, name, sections, extra = [], starts = {}, ...rest }) {
  const obstacles = [...extra];
  const marks = [];
  sections.forEach((level, i) => {
    const dx = i * SECTION_W;
    const lo = dx;
    const hi = i === sections.length - 1 ? Infinity : dx + SECTION_W;
    for (const o of level.obstacles) obstacles.push(shift(o, dx, lo, hi));
    marks.push({ name: level.name, x: dx, ...(i in starts && { start: starts[i] }) });
  });
  return {
    id,
    name,
    sections: marks,
    obstacles,
    width: sections.length * SECTION_W,
    stars: [0],
    ...rest,
  };
}

function moveX(s, dx) {
  const out = { ...s };
  if ('x1' in s) out.x1 = s.x1 + dx;
  if ('x2' in s) out.x2 = s.x2 + dx;
  if (s.qp) out.qp = { ...s.qp, cx: s.qp.cx + dx };
  return out;
}

// An obstacle moved `dx` along, its ground kept within [lo, hi).
export function shift(o, dx, lo = -Infinity, hi = Infinity) {
  const ground = (o.ground || [])
    .map((seg) => {
      const m = moveX(seg, dx);
      // Only open-ended flat ground is cut (sloped or curved pieces are finite).
      if (m.x1 < lo) m.x1 = lo;
      if (m.x2 > hi) m.x2 = hi;
      return m;
    })
    .filter((m) => m.x2 > m.x1);
  const px = dx / 3; // world units to pixels
  return {
    ...o,
    surfaces: o.surfaces.map((s) => moveX(s, dx)),
    solids: o.solids.map((r) => ({ ...r, x: r.x + dx })),
    hazards: (o.hazards || []).map((h) => ({ ...h, x: h.x + dx })),
    ground,
    // regions the renderer looks up by world x (splash on a bail, dirt-filled gap)
    ...(o.splash && { splash: { ...o.splash, x1: o.splash.x1 + dx, x2: o.splash.x2 + dx } }),
    ...(o.dirt && { dirt: { x1: o.dirt.x1 + dx, x2: o.dirt.x2 + dx } }),
    draw(g, fx) {
      g.ox += px;
      o.draw(g, fx);
      g.ox -= px;
    },
  };
}
