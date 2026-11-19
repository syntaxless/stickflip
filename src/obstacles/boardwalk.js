import { box } from './box.js';
import { rail } from './rail.js';
import { P, G, ink, hash, gate, pit } from './art.js';

// Boardwalk's own pieces (Stage 8): sand dunes, a sandcastle, a lifebuoy rail, a sea gap with a
// rope rail, an ice cream cart, a deck chair, a beach ball, a surfboard rack, bunting, a lifeguard
// tower and the pier sign. Chunky shaded pixel art like the rest: black outline, lit edge, darker foot.
const SAND = { body: [238, 214, 150], lit: [253, 238, 184], shade: [206, 176, 112], dark: [170, 140, 84] };
const WOOD = { a: [190, 132, 76], b: [164, 108, 60], lit: [226, 172, 108], dark: [112, 72, 40] };
const SEA = { deep: [16, 74, 156], mid: [34, 128, 208], light: [150, 220, 255], foam: [240, 252, 255] };
const RED = [214, 40, 44];
const WHITE = [252, 252, 252];
const BLUE = [40, 110, 220];
const YELLOW = [255, 212, 70];

// A sand dune: the street rises to a soft crest and falls away again. The sand is heaped over the planks.
export function sandDune({ x, run = 90, h = 30 }) {
  const up = { x1: x, x2: x + run, y1: G, y2: G - h, landable: true };
  const down = { x1: x + run, x2: x + 2 * run, y1: G - h, y2: G, landable: true };
  return {
    type: 'dune',
    surfaces: [],
    solids: [],
    ground: [up, down],
    draw(g) {
      for (let px = P(x); px < P(x + 2 * run); px++) {
        const wx = px * 3 + 1;
        const k = wx < x + run ? (wx - x) / run : 1 - (wx - x - run) / run;
        const top = P(G - h * k);
        const bottom = P(G) - 1;
        for (let py = top; py <= bottom; py++) {
          const hb = hash(px >> 1, py >> 1) % 9;
          g.pset(px, py, py === top ? SAND.lit : hb === 0 ? SAND.shade : hb === 1 ? SAND.lit : SAND.body);
        }
        if (k > 0.05) g.pset(px, top - 1, ink);
        if (hash(px, 5) % 13 === 0) g.pset(px, top + 3, SAND.dark); // a shell or pebble
      }
    },
  };
}

// A sandcastle: a keep with crenellations, a door, a shell trim and a little red flag. A solid hurdle.
export function sandcastle({ x, w = 45, h = 66 }) {
  const block = box({ x, w, h });
  return {
    ...block,
    type: 'sandcastle',
    draw(g, fx = {}) {
      const [l, t, r, b] = [P(x), P(G - h), P(x + w) - 1, P(G) - 1];
      g.fill(l, t + 3, r - l + 1, b - t - 2, SAND.body);
      for (let px = l; px <= r; px += 4) g.fill(px, t, 3, 4, SAND.body); // battlements
      g.rect(l, t + 3, r - l + 1, b - t - 2, ink);
      for (let px = l; px <= r; px += 4) {
        g.fill(px, t, 3, 3, SAND.body);
        g.line(px, t, px + 2, t, SAND.lit);
        g.pset(px - 1, t + 1, ink);
        g.line(px, t - 1, px + 2, t - 1, ink);
      }
      g.line(l + 1, t + 4, r - 1, t + 4, SAND.lit);
      g.fill(l + 1, b - 3, r - l - 1, 3, SAND.shade);
      for (let py = t + 6; py < b - 3; py += 3) for (let px = l + 2; px < r - 1; px += 3) if (hash(px, py) % 5 === 0) g.pset(px, py, SAND.shade);
      const cx = (l + r) >> 1;
      g.fill(cx - 2, b - 9, 5, 9, [96, 72, 44]); // door
      g.rect(cx - 3, b - 10, 7, 10, ink);
      g.pset(cx, b - 14, WHITE); // a shell above it
      g.pset(cx - 1, b - 13, [255, 190, 190]);
      g.pset(cx + 1, b - 13, [255, 190, 190]);
      g.line(cx, t - 9, cx, t - 1, ink); // flag
      const wave = Math.floor((fx.time || 0) * 3) % 2;
      g.fill(cx + 1, t - 9 + wave, 5, 3, RED);
      g.rect(cx + 1, t - 10 + wave, 6, 5, ink);
      g.fill(cx + 1, t - 9 + wave, 5, 3, RED);
    },
  };
}

// A planked rail on wooden posts with a lifebuoy hung under the bar (still an ordinary grind rail).
export function boardRail({ x, length, height, arc = 0 }) {
  const r = rail({ x, length, height, arc });
  return {
    ...r,
    type: 'board-rail',
    draw(g, fx) {
      r.draw(g, fx);
      const cx = P(x + length / 2);
      const cy = P(G - height - arc) + 8;
      g.circle(cx, cy, 5, ink);
      g.circle(cx, cy, 4, WHITE);
      g.circle(cx, cy, 2, ink);
      for (const [dx, dy] of [[0, -4], [0, 4], [-4, 0], [4, 0]]) g.pset(cx + dx, cy + dy, RED);
      g.pset(cx - 3, cy - 2, RED);
      g.pset(cx + 3, cy + 2, RED);
    },
  };
}

// The sea where the boardwalk planks are missing: bright water under the pier, foam at the lips and
// wooden piles. Come up short and you drop in. `rope` hangs a rope rail across it (see ropeRail).
export function seaGap({ x, width }) {
  return pit({
    type: 'sea-gap',
    x,
    width,
    kind: 'water',
    paint(g, fx, { l, r, top }) {
      const t = fx.time || 0;
      g.fill(l, top, r - l + 1, 90, SEA.deep);
      g.fill(l, top + 2, r - l + 1, 10, SEA.mid);
      for (let px = l; px <= r; px++) {
        const wave = Math.floor(Math.sin(px * 0.35 + t * 2.6) * 0.9 + 0.9);
        g.pset(px, top + 2 + wave, SEA.light);
        if (hash(px, 17) % 10 === 0) g.pset(px, top + 6 + (hash(px, 2) % 4), SEA.light);
        if (hash(px, 31) % 17 === 0) g.pset(px, top + 2 + wave - 1, SEA.foam);
      }
      for (const px of [l - 1, r + 1]) g.line(px, top, px, top + 90, ink);
      // the boards' ends: a dark plank edge at each lip, and foam in the corners
      for (const [px, d] of [[l, 1], [r, -1]]) {
        for (let i = 0; i < 4; i++) g.fill(px + d * i, top, 1, 3 - (i >> 1), WOOD.b);
        g.fill(px, top + 3, 1, 1, SEA.foam);
      }
      // piles: a few wooden posts standing in the water
      for (let px = l + 24; px < r - 10; px += 30) {
        g.fill(px, top + 4, 3, 40, WOOD.dark);
        g.line(px, top + 4, px, top + 40, WOOD.b);
        g.line(px - 1, top + 4, px - 1, top + 40, ink);
        g.line(px + 3, top + 4, px + 3, top + 40, ink);
        g.fill(px - 1, top + 3 + Math.round(Math.sin(t * 2 + px)), 5, 1, SEA.foam);
      }
    },
  });
}

// A rope rail on wooden piles, hung over the sea: a rope you grind (a knot every few pixels).
export function ropeRail({ x, length, height }) {
  const r = rail({ x, length, height });
  return {
    ...r,
    type: 'rope-rail',
    draw(g) {
      const base = P(G) + 8;
      const [l, rr, y] = [P(x), P(x + length) - 1, P(G - height)];
      const posts = [l + 3, rr - 3];
      for (let px = l + 30; px < rr - 20; px += 30) posts.push(px);
      for (const px of posts) {
        g.fill(px - 1, y, 3, base - y, WOOD.a);
        g.line(px - 1, y, px - 1, base, WOOD.lit);
        g.line(px - 2, y, px - 2, base, ink);
        g.line(px + 2, y, px + 2, base, ink);
        g.fill(px - 2, y - 1, 5, 2, WOOD.dark);
      }
      g.line(l, y - 2, rr, y - 2, ink);
      g.line(l, y - 1, rr, y - 1, [240, 226, 190]);
      g.line(l, y, rr, y, [196, 176, 130]);
      for (let px = l + 2; px < rr; px += 4) g.pset(px, y - 1, [150, 124, 80]);
    },
  };
}

// An ice cream cart: a white box on two wheels with a blue stripe and a striped umbrella. The top is
// landable and grindable.
export function beachCart({ x, w = 100, h = 56 }) {
  const block = box({ x, w, h, landable: true, grindable: true });
  return {
    ...block,
    type: 'beach-cart',
    draw(g) {
      const [l, t, r, b] = [P(x), P(G - h), P(x + w) - 1, P(G) - 1];
      g.fill(l, t, r - l + 1, b - t + 1, WHITE);
      g.rect(l, t, r - l + 1, b - t + 1, ink);
      g.line(l + 1, t + 1, r - 1, t + 1, [255, 255, 255]);
      g.line(l + 1, t + 2, r - 1, t + 2, [214, 226, 240]);
      g.fill(l + 1, t + 6, r - l - 1, 4, BLUE);
      g.line(l + 1, t + 6, r - 1, t + 6, [120, 170, 255]);
      g.fill(l + 1, b - 5, r - l - 1, 4, [200, 214, 232]);
      // a sliding window with a cone sign
      const wx = l + 4;
      g.fill(wx, t + 12, 10, 8, [150, 210, 245]);
      g.rect(wx - 1, t + 11, 12, 10, ink);
      g.line(wx + 2, t + 13, wx + 6, t + 13, WHITE);
      g.text('ICE', r - 19, t + 13, RED, 1, 'left');
      for (const wxc of [l + 8, r - 8]) {
        g.circle(wxc, b - 2, 3, ink, true);
        g.circle(wxc, b - 2, 1, [200, 200, 210], true);
      }
      // a parasol standing up out of the middle, for colour
      const px = (l + r) >> 1;
      g.line(px, t - 1, px, t - 12, ink);
      for (let i = -9; i <= 9; i++) {
        const top = t - 12 - Math.round(Math.sqrt(Math.max(0, 81 - i * i)) * 0.45);
        g.fill(px + i, top, 1, 3, Math.floor((i + 9) / 3) % 2 ? WHITE : RED);
        g.pset(px + i, top - 1, ink);
      }
    },
  };
}

// A striped deck chair, low enough to slappy.
export function deckChair({ x, w = 54, h = 27 }) {
  const block = box({ x, w, h, grindable: true });
  return {
    ...block,
    type: 'deck-chair',
    draw(g) {
      const [l, t, r, b] = [P(x), P(G - h), P(x + w) - 1, P(G) - 1];
      const stripe = (px) => (Math.floor((px - l) / 3) % 2 ? WHITE : BLUE);
      for (let px = l; px <= r; px++) {
        const k = (px - l) / (r - l); // the back rises toward the right
        const back = Math.round(t - 4 + (1 - k) * 0);
        g.fill(px, back + 3, 1, b - back - 5, stripe(px));
        g.pset(px, back + 3, ink);
      }
      g.rect(l, t - 1, r - l + 1, b - t + 1, ink);
      g.line(l + 1, t, r - 1, t, [255, 255, 255]);
      g.line(l, b, l + 2, b, ink);
      g.line(r - 2, b, r, b, ink);
      g.fill(l + 1, b - 2, r - l - 1, 2, WOOD.b);
    },
  };
}

// A beach ball standing in the road: a solid hurdle. Quarters of red, white, blue and yellow.
export function beachBall({ x, w = 42, h = 42 }) {
  const block = box({ x, w, h });
  return {
    ...block,
    type: 'beach-ball',
    draw(g) {
      const r = Math.round(P(Math.min(w, h)) / 2);
      const cx = P(x + w / 2);
      const cy = P(G) - 1 - r;
      g.circle(cx, cy, r + 1, ink, true);
      for (let dy = -r; dy <= r; dy++) {
        const half = Math.round(Math.sqrt(r * r - dy * dy));
        for (let dx = -half; dx <= half; dx++) {
          const ang = Math.atan2(dy, dx) + Math.PI + 0.5;
          const seg = Math.floor((ang / (Math.PI * 2)) * 6) % 6;
          g.pset(cx + dx, cy + dy, [RED, WHITE, BLUE, WHITE, YELLOW, WHITE][seg]);
        }
      }
      g.pset(cx - 3, cy - 4, [255, 255, 255]);
      g.fill(cx - 1, cy - 1, 2, 2, ink);
    },
  };
}

// A rack of surfboards: three boards leaning on a wooden frame. A solid hurdle.
export function surfRack({ x, w = 60, h = 57 }) {
  const block = box({ x, w, h });
  return {
    ...block,
    type: 'surf-rack',
    draw(g) {
      const [l, t, r, b] = [P(x), P(G - h), P(x + w) - 1, P(G) - 1];
      const colours = [[255, 120, 60], [60, 200, 200], [255, 220, 80]];
      colours.forEach((c, i) => {
        const bx = l + 2 + i * 6;
        for (let py = t; py <= b; py++) {
          const k = (py - t) / (b - t);
          const half = Math.round(1 + 1.6 * Math.sin(k * Math.PI));
          g.fill(bx - half, py, half * 2 + 1, 1, c);
          g.pset(bx - half - 1, py, ink);
          g.pset(bx + half + 1, py, ink);
        }
        g.line(bx, t + 2, bx, b - 2, [255, 255, 255]);
        g.pset(bx, t - 1, ink);
      });
      g.fill(l - 1, b - 5, r - l + 3, 2, WOOD.b); // the frame
      g.rect(l - 1, b - 6, r - l + 3, 4, ink);
      g.fill(r - 4, t + 4, 3, b - t - 4, WOOD.a);
      g.line(r - 5, t + 4, r - 5, b, ink);
      g.line(r - 1, t + 4, r - 1, b, ink);
    },
  };
}

// Bunting: two striped poles with a string of little flags across the top. Pass under it, or jump
// through it (head inside the opening) for a bonus; head above the string and you tangle in it.
export function bunting({ x, top, bottom, name = 'BEACH FLAG', points = 250 }) {
  const flags = [RED, YELLOW, BLUE, WHITE];
  return gate({
    type: 'bunting',
    x,
    top,
    bottom,
    name,
    points,
    paint(g, fx, hz) {
      const cx = P(x);
      const t = P(hz.top);
      const ground = P(G) - 1;
      const reach = 6;
      for (const px of [cx - reach, cx + reach]) {
        for (let py = t - 2; py <= ground; py++) {
          g.pset(px - 1, py, ink);
          g.pset(px + 1, py, ink);
          g.pset(px, py, Math.floor((py - t) / 3) % 2 === 0 ? RED : WHITE);
        }
        g.fill(px - 2, ground, 5, 1, ink);
        g.fill(px - 1, ground - 1, 3, 1, SAND.body);
      }
      const sway = Math.floor((fx.time || 0) * 2.5) % 2;
      g.line(cx - reach, t - 1, cx + reach, t - 1, ink);
      for (let i = 0; i < 5; i++) {
        const fx0 = cx - reach + 1 + i * 2 + (i > 1 ? 1 : 0);
        g.fill(fx0, t, 2, 3 + ((i + sway) % 2), flags[i % 4]);
        g.pset(fx0, t + 3 + ((i + sway) % 2), ink);
      }
    },
  });
}

// A lifeguard tower: a white cabin on a frame with a red-and-white striped roof. Ollie up onto the
// roof and ride it, grind the roof edge, or fly the lot. Roll off the end and drop back to the street.
export function lifeguardTower({ x, w = 190, h = 76 }) {
  const block = box({ x, w, h, landable: true, grindable: true });
  return {
    ...block,
    type: 'lifeguard-tower',
    draw(g, fx = {}) {
      const [l, t, r, b] = [P(x), P(G - h), P(x + w) - 1, P(G) - 1];
      // walls: white planks
      g.fill(l, t + 4, r - l + 1, b - t - 3, WHITE);
      for (let px = l + 4; px < r; px += 5) g.line(px, t + 5, px, b - 1, [214, 226, 240]);
      g.rect(l, t + 4, r - l + 1, b - t - 3, ink);
      // roof: striped slab you ride on
      for (let px = l - 2; px <= r + 2; px++) g.fill(px, t - 2, 1, 6, Math.floor((px - l + 2) / 4) % 2 ? WHITE : RED);
      g.rect(l - 2, t - 3, r - l + 5, 7, ink);
      g.line(l - 1, t - 2, r + 1, t - 2, [255, 255, 255]);
      g.line(l - 1, t + 3, r + 1, t + 3, [160, 30, 36]);
      // a window with a shutter, the word, and the stilts' cross braces
      const wx = r - 22;
      g.fill(wx, t + 9, 14, 9, [150, 210, 245]);
      g.rect(wx - 1, t + 8, 16, 11, ink);
      g.line(wx + 7, t + 9, wx + 7, t + 17, ink);
      g.text('RESCUE', l + 4, t + 22, RED, 1, 'left');
      g.line(l + 2, b - 1, r - 2, t + 21, [200, 212, 230]);
      g.line(r - 2, b - 1, l + 2, t + 21, [200, 212, 230]);
      // a flag on the roof
      const cx = r - 10;
      g.line(cx, t - 14, cx, t - 3, ink);
      const wave = Math.floor((fx.time || 0) * 3) % 2;
      g.fill(cx + 1, t - 14 + wave, 7, 4, YELLOW);
      g.rect(cx + 1, t - 15 + wave, 8, 6, ink);
      g.fill(cx + 1, t - 14 + wave, 7, 4, YELLOW);
    },
  };
}

// The end of the pier: a sign over the road, lit with bulbs that chase. Scenery only.
export function pierSign({ x }) {
  return {
    type: 'pier-sign',
    surfaces: [],
    solids: [],
    draw(g, fx = {}) {
      const cx = P(x);
      const ground = P(G) - 1;
      const top = ground - 62;
      for (const px of [cx - 20, cx + 20]) {
        g.fill(px - 1, top, 3, ground - top, WOOD.a);
        g.line(px - 2, top, px - 2, ground, ink);
        g.line(px + 2, top, px + 2, ground, ink);
        g.line(px - 1, top, px - 1, ground, WOOD.lit);
      }
      g.fill(cx - 25, top - 12, 51, 14, [30, 70, 150]);
      g.rect(cx - 26, top - 13, 53, 16, ink);
      g.text('PIER 8', cx, top - 9, WHITE, 1, 'center');
      const phase = Math.floor((fx.time || 0) * 4);
      for (let i = 0; i < 26; i++) {
        const lit = (i + phase) % 3 === 0;
        g.pset(cx - 24 + i * 2, top - 12, lit ? YELLOW : [150, 120, 40]);
        g.pset(cx - 24 + i * 2, top + 1, lit ? [150, 120, 40] : YELLOW);
      }
    },
  };
}
