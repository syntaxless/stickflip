// Dev tool: finds the rival's cues for Hellride (src/levels/hell-*.js `cues`) by riding the real course
// with candidate inputs and picking the middle of the window that clears every obstacle at every
// pace the rubber band can give. Prints each section's window. Run: node scripts/solve-rival.mjs
import { Game } from '../src/game.js';
import { Rival } from '../src/rival.js';
import { STAGES } from '../src/stages/index.js';
import { readFileSync, writeFileSync } from 'node:fs';

const base = STAGES[5];
const W = 960;
export const PACES = [0.97, 1.0, 1.04, 1.08];

// Rides the course with `cues` (strip x) at constant pace k until x >= stopX. Returns { ok, t, bailX, x }.
export function ride(cues, k, stopX, fromSection = 0, level = base) {
  const lv = { ...level, race: { ...level.race, cues } };
  const r = new Rival(Game, lv);
  r.place({ index: fromSection, score: 0 });
  r.pace = () => k;
  r.begin();
  const g = r.game;
  let t = 0;
  while (t < 40) {
    r.update(1 / 120, 0);
    t += 1 / 120;
    if (g.phase === 'bailed') return { ok: false, t, bailX: g.sk.x, reason: g.bailReason };
    if (r.finished) return { ok: true, t, x: g.sk.x };
    if (g.sk.x >= stopX && g.sk.mode === 'roll') return { ok: true, t, x: g.sk.x };
  }
  return { ok: false, t, bailX: g.sk.x, reason: 'timeout' };
}

const okAll = (cues, stopX, from, paces = PACES) => paces.every((k) => ride(cues, k, stopX, from).ok);

// All x in [lo, hi] (step) for which `build(x)` rides clean at every pace.
function window1(prefix, section, build, lo, hi, step = 4, stop = W + 40) {
  const stopX = section * W + stop;
  const good = [];
  for (let x = lo; x <= hi; x += step) if (okAll([...prefix, ...build(x)], stopX, 0)) good.push(x);
  return good;
}
const mid = (xs) => {
  // the middle of the longest run of consecutive good x
  let best = [];
  let cur = [];
  for (const x of xs) {
    if (cur.length && x - cur[cur.length - 1] > 4) cur = [];
    cur.push(x);
    if (cur.length > best.length) best = [...cur];
  }
  return best.length ? { x: best[Math.floor(best.length / 2)], lo: best[0], hi: best[best.length - 1] } : null;
};

export { window1, mid, okAll };

// The plan: for each obstacle, the section-relative x the rival rides toward, and the cues as a
// function of the lead time (s) being searched. Sections are solved in order, each with the
// earlier cues fixed. `stop` is where it must be safely rolling again.
const tap = (x, lead) => [{ x, lead, act: 'tap' }];
const tapLock = (x, lead) => [{ x, lead, act: 'tap' }, { x: x + 1, act: 'lock' }];
const PLAN = [
  { section: 0, name: 'barricade', at: 800, build: tap },
  { section: 1, name: 'kicker rail', at: 200, build: tapLock },
  { section: 2, name: 'moat rail', at: 300, build: tapLock },
  { section: 3, name: 'hurdle 1', at: 340, build: tap, stop: 730 },
  { section: 3, name: 'hurdle 2', at: 780, build: tap },
  { section: 4, name: 'bone bar', at: 340, build: tapLock },
  { section: 5, name: 'fire pit', at: 330, build: tap },
  { section: 6, name: 'stairs grind', at: 420, build: tapLock },
  { section: 7, name: 'hellmouth rail', at: 310, build: tapLock },
  { section: 8, name: 'tall block', at: 380, build: tap, stop: 700 },
];

const FILES = ['hell-bumps', 'hell-rail', 'hell-moat', 'hell-hurdles', 'hell-bar', 'hell-fire-pit', 'hell-stairs', 'hell-mouth', 'hell-finish'];
const fmt = (c) => `{ x: ${c.x}${c.lead !== undefined ? `, lead: ${c.lead}` : ''}, act: '${c.act}' }`;

// Rewrites the `cues:` line of each section file (src/levels/hell-*.js), x relative to the section.
function writeCues(cues) {
  FILES.forEach((f, i) => {
    const mine = cues.filter((c) => Math.floor(c.x / W) === i).map((c) => ({ ...c, x: c.x - i * W }));
    if (!mine.length) return;
    const path = new URL(`../src/levels/${f}.js`, import.meta.url);
    const line = `  cues: [${mine.map(fmt).join(', ')}], // the rival's inputs (node scripts/solve-rival.mjs --write)`;
    const src = readFileSync(path, 'utf8');
    writeFileSync(path, /^ {2}cues: .*$/m.test(src) ? src.replace(/^ {2}cues: .*$/m, line) : src.replace(/^( {2}name: .*\n)/m, `$1${line}\n`));
  });
  console.log('cues written to src/levels/hell-*.js');
}

if (process.argv[1].endsWith('solve-rival.mjs')) {
  let cues = [];
  for (const p of PLAN) {
    const ax = p.section * W + p.at;
    const stop = p.section * W + (p.stop ?? W + 40);
    const good = [];
    for (let lead = -0.6; lead <= 1.2; lead += 0.01) {
      if (okAll([...cues, ...p.build(ax, lead)], stop, 0)) good.push(Math.round(lead * 100));
    }
    // the middle of the longest run of consecutive leads
    let best = [];
    let cur = [];
    for (const v of good) {
      if (cur.length && v - cur[cur.length - 1] > 1) cur = [];
      cur.push(v);
      if (cur.length > best.length) best = [...cur];
    }
    if (!best.length) {
      console.log(`${p.name}: NO WINDOW`);
      break;
    }
    const lead = best[Math.floor(best.length / 2)] / 100;
    console.log(`${p.name}: lead ${lead} s (window ${best[0] / 100}..${best[best.length - 1] / 100} s, ${best.length} cs wide)`);
    cues = [...cues, ...p.build(ax, lead)];
  }
  if (process.argv.includes('--write')) writeCues(cues);
  for (const k of PACES) {
    const r = ride(cues, k, Infinity);
    console.log('pace', k, r.ok ? `finishes in ${r.t.toFixed(2)}s` : `FAILS ${r.reason} at ${Math.round(r.bailX)}`);
  }
}
