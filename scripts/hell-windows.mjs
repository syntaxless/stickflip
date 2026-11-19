// Dev tool: prints the player's timing windows for every Hellride checkpoint (seconds after the rider rolls
// off from the restart point, at cruising speed): a plain ollie, a charged ollie (let go at t), and ollie then
// hold to lock a grind. Run: node scripts/hell-windows.mjs
import { Game } from '../src/game.js';
import { STAGES } from '../src/stages/index.js';

const STEP = 1 / 120;
const st = STAGES[5];

function clears(i, acts) {
  const g = new Game(st, null, { index: i, score: 0 });
  g.rival = null;
  g.tap();
  const last = i === st.sections.length - 1;
  const goal = last ? st.race.finishX : st.sections[i + 1].x + 150;
  const q = [...acts].sort((a, b) => a[0] - b[0]);
  let t = 0;
  while (t < 9 && g.phase === 'playing') {
    while (q.length && q[0][0] <= t + 1e-9) {
      const [, k] = q.shift();
      if (k === 'tap') g.tap();
      else if (k === 'hold') g.setHold(true);
      else if (k === 'cs') g.startCharge();
      else if (k === 'cr') g.releaseCharge();
    }
    g.update(STEP);
    t += STEP;
    if (g.sk.x > goal && g.sk.mode === 'roll') return true;
  }
  return g.phase === 'complete';
}

// the widest run of consecutive good times: "lo-hi (width s)"
function windows(make, to, step = 0.01) {
  let best = null;
  let cur = null;
  for (let t = 0; t <= to; t += step) {
    if (clears(i, make(t))) {
      cur = cur ? { ...cur, hi: t } : { lo: t, hi: t };
      if (!best || cur.hi - cur.lo > best.hi - best.lo) best = cur;
    } else cur = null;
  }
  return best ? `${best.lo.toFixed(2)}-${best.hi.toFixed(2)} s (${(best.hi - best.lo + step).toFixed(2)} wide)` : '-';
}

let i = 0;
console.log('| # | Section | Plain ollie (tap at) | Charged ollie (let go at) | Ollie, then hold to lock the grind (ollie at) |');
console.log('|---|---|---|---|---|');
for (i = 0; i < st.sections.length; i++) {
  const plain = windows((t) => [[t, 'tap']], 2.8);
  const charged = windows((t) => [[0, 'cs'], [Math.min(t, 1.6), 'cr']], 1.6);
  const lock = windows((t) => [[t, 'tap'], [t, 'hold']], 1.8);
  console.log(`| ${i + 1} | ${st.sections[i].name} | ${plain} | ${charged} | ${lock} |`);
}
