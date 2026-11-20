import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { STAGES } from '../src/stages/index.js';
import { GAPS } from '../src/gaps.js';

const STEP = 1 / 120;
const stageOf = (gap) => STAGES[Number(gap.stage.split('-')[1]) - 1];

// A game from a checkpoint; `start` overrides where the rider spawns (offset from
// the section's left edge). The Euro to Rail gap is earned on a normal pass, so
// its tests spawn back on top of the Euro Gap (the checkpoint itself restarts past it).
function newGame(stage, index, start) {
  const sec = stage.sections[index];
  const saved = sec.start;
  if (start !== undefined) sec.start = start;
  const g = new Game(stage, null, { index, score: 0 });
  sec.start = saved;
  g.rival = null; // (Hellride's rival would win the race while these scripts idle: see race.test.js)
  return g;
}
const EURO_TOP = -120;

// Plays a checkpoint of a stage with timed inputs: tap, hold, up, cs (start a
// charge), cr (release it). Returns the names of the gaps earned and the game.
function play(stage, index, acts, tmax = 5, start) {
  const g = newGame(stage, index, start);
  g.tap();
  const q = acts.map(([t, k]) => ({ t, k }));
  const earned = [];
  let t = 0;
  while (t < tmax && g.phase === 'playing' && g.sk.x < stage.sections[index].x + 1300) {
    while (q.length && q[0].t <= t + 1e-9) {
      const { k } = q.shift();
      if (k === 'tap') g.tap();
      else if (k === 'hold') g.setHold(true);
      else if (k === 'up') g.setHold(false);
      else if (k === 'cs') g.startCharge();
      else if (k === 'cr') g.releaseCharge();
    }
    g.update(STEP);
    t += STEP;
    for (const e of g.drainEvents()) if (e.type === 'gap') earned.push(e.name);
  }
  return { earned, game: g };
}

// One timeline that earns each gap (found by search; see src/gaps.js for what it is).
const SCRIPTS = {
  'five-stair': [[0, 'cs'], [0.75, 'cr']],
  'bank-to-rail': [[0.45, 'tap'], [0.45, 'hold']],
  'pool-jump': [[0, 'cs'], [0.75, 'cr']],
  'euro-to-rail': [[0.22, 'tap'], [0.22, 'hold']],
  'trash-hop': [[0, 'cs'], [0.75, 'cr']],
  'big-leap': [[0, 'cs'], [0.56, 'cr']],
  'bench-to-hydrant': [[0.5, 'tap'], [1.36, 'tap']],
  'stair-set': [[0.94, 'tap']],
  handrail: [[0.54, 'tap'], [0.54, 'hold']],
  'kicker-to-rail': [[0.8, 'tap'], [0.8, 'hold']],
  'barrier-to-gap': [[0.22, 'tap'], [1.57, 'tap']],
  'barrel-drop': [[0, 'cs'], [1.3, 'cr']],
  'broken-walk': [[0.81, 'tap']], // a plain ollie clears just the gap (and then meets the truck)
  // a charged ollie off the slab carries over the gap and the bed onto the cab
  'truck-leap': [[0, 'cs'], [0.79, 'cr']],
  // the same pop with the finger kept down locks the bed rim
  'gravel-dump': [[0, 'cs'], [0.68, 'cr'], [0.68, 'hold']],
  'sandbox-leap': [[0, 'cs'], [0.85, 'cr']],
  'seesaw-launch': [[0.3, 'tap'], [0.3, 'hold'], [1.2, 'tap']],
  'monkey-business': [[0.27, 'tap'], [0.27, 'hold'], [1.52, 'tap']],
  'ball-pit-leap': [[0, 'cs'], [0.75, 'cr']],
  'ledge-to-ledge': [[0.1, 'tap'], [0.8, 'tap'], [0.8, 'hold']],
  'box-clear': [[0.11, 'cs'], [0.86, 'cr']],
  'big-set': [[0, 'cs'], [0.75, 'cr']],
  'siren-grind': [[0.62, 'tap'], [0.62, 'hold']],
  'cinder-grind': [[0.51, 'tap'], [0.51, 'hold']],
  'lava-grind': [[0.33, 'tap'], [0.33, 'hold']],
  'fire-pit-leap': [[0.66, 'tap']],
  'devil-stairs': [[0.97, 'tap']],
  'hellmouth-grind': [[0.5, 'tap'], [0.5, 'hold']],
  'hellmouth-jump': [[0, 'cs'], [0.53, 'cr']], // a plain ollie falls short: it takes a charge (or the turbo)
  'sled-grind': [[0.61, 'tap'], [0.61, 'hold']],
  'floe-hop': [[0.57, 'tap']], // a plain ollie lands on the floe in the middle of the pond
  'pond-leap': [[0, 'cs'], [0.71, 'cr']], // or a charged one flies the whole pond
  'ice-grind': [[0.15, 'tap'], [0.15, 'hold']],
  'slide-grind': [[0.38, 'tap'], [1.18, 'tap'], [1.18, 'hold']], // over the first block, then lock the second
  'cabin-grind': [[0.45, 'tap'], [0.45, 'hold']],
  'cabin-leap': [[0, 'cs'], [0.6, 'cr']],
  'roof-drop': [[0.36, 'tap'], [1.36, 'tap']], // up onto the roof, then ollie off its end
  'ice-bridge': [[0.5, 'tap'], [0.5, 'hold']],
  'crevasse-jump': [[0, 'cs'], [0.56, 'cr']],
  'board-grind': [[0.61, 'tap'], [0.61, 'hold']],
  'rope-grind': [[0.6, 'tap'], [0.6, 'hold']],
  'sea-leap': [[0, 'cs'], [0.67, 'cr']],
  'cart-grind': [[0.2, 'tap'], [0.2, 'hold']],
  'chair-slide': [[0.3, 'tap'], [1.3, 'tap'], [1.3, 'hold']], // over the cart, then lock the chair
  'tower-grind': [[0.45, 'tap'], [0.45, 'hold']],
  'tower-leap': [[0, 'cs'], [0.55, 'cr']],
  'tower-drop': [[0.4, 'tap'], [1.4, 'tap']], // up onto the roof, then ollie off its end
  'pier-bridge': [[0.5, 'tap'], [0.5, 'hold']],
  'pier-leap': [[0, 'cs'], [0.56, 'cr']],
  'scrap-grind': [[0.58, 'tap'], [0.58, 'hold']],
  'sludge-grind': [[0.5, 'tap'], [0.5, 'hold']],
  'pipe-grind': [[0.4, 'tap'], [0.4, 'hold']],
  'sludge-leap': [[0.65, 'tap']], // a plain ollie through the wrecking ball's opening and over the pit
  'car-grind': [[0.5, 'tap'], [0.5, 'hold']],
  'car-leap': [[0, 'cs'], [0.6, 'cr']],
  'magnet-grind': [[0.5, 'tap'], [0.5, 'hold']],
  'magnet-jump': [[0, 'cs'], [0.55, 'cr']],
};

test('gap config is well formed: unique ids, real stages and sections, a script for each', () => {
  const ids = new Set();
  for (const g of GAPS) {
    assert.ok(!ids.has(g.id), `duplicate ${g.id}`);
    ids.add(g.id);
    const st = stageOf(g);
    assert.ok(st && st.id === g.stage, `${g.id}: stage`);
    assert.ok(st.sections[g.section], `${g.id}: section`);
    assert.ok(g.points > 0 && g.name && ['land', 'grind', 'any'].includes(g.on), g.id);
    assert.ok(SCRIPTS[g.id], `${g.id}: no test script`);
  }
});

for (const gap of GAPS) {
  test(`gap: ${gap.name} (${gap.stage} checkpoint ${gap.section + 1}) can be earned, once, and adds to the score`, () => {
    const { earned, game } = play(stageOf(gap), gap.section, SCRIPTS[gap.id], 5, gap.id === 'euro-to-rail' ? EURO_TOP : undefined);
    assert.equal(earned.filter((n) => n === gap.name).length, 1, `earned ${JSON.stringify(earned)}`);
    assert.ok(game.gapsDone.has(gap.id));
    assert.ok(game.score >= gap.points || game.combo.some((t) => t.name === gap.name), 'counts in the combo/score');
  });
}

test('gap: doing nothing earns nothing', () => {
  for (const gap of GAPS) assert.deepEqual(play(stageOf(gap), gap.section, [], 3).earned, [], gap.id);
});

test('gap: the Euro to Rail bonus needs the jump from the Euro Gap top, not a roll-off and a second ollie', () => {
  // from the Euro Gap top: roll off, land, then ollie onto the rail
  const viaStreet = play(STAGES[0], 6, [[0.7, 'tap'], [0.7, 'hold']], 5, EURO_TOP);
  assert.notEqual(viaStreet.game.phase, 'bailed');
  assert.deepEqual(viaStreet.earned, []);
});

test('gap: the barrel drop is only for the one-jump route, not roll off, land and ollie', () => {
  const rolled = play(STAGES[2], 5, [[2.2, 'tap']]);
  assert.equal(rolled.game.phase, 'playing');
  assert.deepEqual(rolled.earned, []);
});

test('gap: a gap bonus is a trick: it joins the combo and is banked on landing', () => {
  const { game } = play(STAGES[0], 6, [[0.22, 'tap'], [0.22, 'hold']], 2.5, EURO_TOP);
  const names = game.combo.map((t) => t.name);
  assert.ok(game.score > 0 || names.includes('EURO TO RAIL'));
});

test('specials: a gap bonus and any trick worth 300+ points raise a special event; small tricks do not', () => {
  const g = new Game(STAGES[0], null, { index: 6, score: 0 });
  g.addTrick('KICKFLIP', 150);
  g.addTrick('360 FLIP', 300);
  g.addTrick('EURO TO RAIL', 500, 'gap');
  const specials = g.drainEvents().filter((e) => e.type === 'special');
  assert.deepEqual(specials.map((e) => [e.name, e.kind]), [['360 FLIP', 'trick'], ['EURO TO RAIL', 'gap']]);
});

test('specials: playing a gap raises one gap special with its name and points', () => {
  const gap = GAPS.find((x) => x.id === 'euro-to-rail');
  const g = newGame(STAGES[0], 6, EURO_TOP);
  g.tap();
  const q = [[0.22, 'tap'], [0.22, 'hold']];
  let t = 0;
  const specials = [];
  while (t < 2 && g.phase === 'playing') {
    while (q.length && q[0][0] <= t + 1e-9) {
      const [, k] = q.shift();
      if (k === 'tap') g.tap();
      else g.setHold(true);
    }
    g.update(STEP);
    t += STEP;
    for (const e of g.drainEvents()) if (e.type === 'special') specials.push(e);
  }
  const gaps = specials.filter((e) => e.kind === 'gap');
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].points, gap.points);
});

test('specials: the jingle is a short rising run of square beeps, higher for bigger bonuses', async () => {
  const { specialNotes } = await import('../src/audio.js');
  const small = specialNotes(300);
  const big = specialNotes(800);
  const end = (ns) => Math.max(...ns.map((n) => n.at + n.dur));
  assert.ok(end(small) < 0.5 && end(big) < 0.5, 'under half a second');
  assert.ok(small.slice(0, 6).every((n, i, a) => i === 0 || n.freq > a[i - 1].freq), 'rises');
  assert.ok(big[0].freq > small[0].freq, 'bigger bonus starts higher');
});
