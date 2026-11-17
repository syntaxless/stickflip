import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { STAGES } from '../src/stages/index.js';
import { GAPS } from '../src/gaps.js';

const STEP = 1 / 120;
const stageOf = (gap) => STAGES[Number(gap.stage.split('-')[1]) - 1];

// Plays a checkpoint of a stage with timed inputs: tap, hold, up, cs (start a
// charge), cr (release it). Returns the names of the gaps earned and the game.
function play(stage, index, acts, tmax = 5) {
  const g = new Game(stage, null, { index, score: 0 });
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
  'pool-jump': [[0, 'cs'], [0.75, 'cr']],
  'euro-to-rail': [[0.22, 'tap'], [0.22, 'hold']],
  'trash-hop': [[0, 'cs'], [0.75, 'cr']],
  'big-leap': [[0, 'cs'], [0.75, 'cr']],
  'barrier-to-gap': [[0.1, 'tap'], [1.05, 'tap']],
  'barrel-drop': [[0, 'cs'], [0.75, 'cr']],
  'broken-walk': [[0, 'cs'], [0.75, 'cr']],
  'sandbox-leap': [[0, 'cs'], [0.75, 'cr']],
  'seesaw-launch': [[0.3, 'tap'], [0.3, 'hold'], [1.2, 'tap']],
  'monkey-business': [[0.15, 'tap'], [0.15, 'hold'], [1.4, 'tap']],
  'ball-pit-leap': [[0, 'cs'], [0.75, 'cr']],
  'ledge-to-ledge': [[0.1, 'tap'], [0.8, 'tap'], [0.8, 'hold']],
  'box-clear': [[0.11, 'cs'], [0.86, 'cr']],
  'big-set': [[0, 'cs'], [0.75, 'cr']],
  'siren-grind': [[0.62, 'tap'], [0.62, 'hold']],
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
    const { earned, game } = play(stageOf(gap), gap.section, SCRIPTS[gap.id]);
    assert.equal(earned.filter((n) => n === gap.name).length, 1, `earned ${JSON.stringify(earned)}`);
    assert.ok(game.gapsDone.has(gap.id));
    assert.ok(game.score >= gap.points || game.combo.some((t) => t.name === gap.name), 'counts in the combo/score');
  });
}

test('gap: doing nothing earns nothing', () => {
  for (const gap of GAPS) assert.deepEqual(play(stageOf(gap), gap.section, [], 3).earned, [], gap.id);
});

test('gap: the Euro to Rail bonus needs the jump from the Euro Gap top, not a roll-off and a second ollie', () => {
  // from the replay spawn on top of the Euro Gap: roll off, land, then ollie onto the rail
  const viaStreet = play(STAGES[0], 6, [[0.7, 'tap'], [0.7, 'hold']]);
  assert.equal(viaStreet.game.phase, 'playing');
  assert.deepEqual(viaStreet.earned, []);
});

test('gap: the barrel drop is only for the one-jump route, not roll off, land and ollie', () => {
  const rolled = play(STAGES[2], 5, [[1.4, 'tap']]);
  assert.equal(rolled.game.phase, 'playing');
  assert.deepEqual(rolled.earned, []);
});

test('gap: a gap bonus is a trick: it joins the combo and is banked on landing', () => {
  const { game } = play(STAGES[0], 6, [[0.22, 'tap'], [0.22, 'hold']], 2.5);
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
  const g = new Game(STAGES[0], null, { index: 6, score: 0 });
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
