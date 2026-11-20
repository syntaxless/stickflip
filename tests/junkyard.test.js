import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { Rival } from '../src/rival.js';
import { STAGES } from '../src/stages/index.js';
import { GAPS } from '../src/gaps.js';
import { RACE } from '../src/config.js';
import { Pix, PAL, setPalette } from '../src/render/pixel.js';
import { Renderer } from '../src/render/renderer.js';

// Stage 9, Junkyard: a second race, harder than Hellride. The same rival system (rival.js), a quicker rival
// that barely eases off, and scrap obstacles that each have a safe line and a riskier one.

const STEP = 1 / 120;
const junk = STAGES[8];
const hell = STAGES[5];
const names = junk.sections.map((s) => s.name);

function play(i, acts, tmax = 6) {
  const g = new Game(junk, null, { index: i, score: 0 });
  g.rival = null; // these checks are about the obstacles, not the race
  g.tap();
  const q = acts.map(([t, k]) => ({ t, k }));
  const earned = [];
  let t = 0;
  while (t < tmax && g.phase === 'playing' && g.sk.x < junk.sections[i].x + 1300) {
    while (q.length && q[0].t <= t + 1e-9) {
      const { k } = q.shift();
      if (k === 'tap') g.tap();
      else if (k === 'hold') g.setHold(true);
      else if (k === 'cs') g.startCharge();
      else if (k === 'cr') g.releaseCharge();
    }
    g.update(STEP);
    t += STEP;
    for (const e of g.drainEvents()) if (e.type === 'special' || e.type === 'gap') earned.push(e.name || e.text);
  }
  return { g, earned, t };
}
const cleared = (r, i) => r.g.phase === 'complete' || r.g.sk.x > (i === 8 ? junk.race.finishX : junk.sections[i + 1].x + 150);

// A bot that rides a game by the rival's own cues, at a fixed pace (a player taking the rival's line).
function race(pace, tmax = 45) {
  const game = new Game(junk);
  game.tap();
  const bot = new Rival(Game, junk);
  bot.game = game;
  bot.pace = () => pace;
  bot.running = true;
  bot.next = 0;
  let t = 0;
  while (t < tmax && game.phase !== 'complete' && game.phase !== 'beaten') {
    bot.update(STEP, 0);
    if (game.phase === 'bailed') break;
    t += STEP;
  }
  return { game, t };
}

test('stage 9 is Junkyard: a nine-section race with turbo, its own palette and sky', () => {
  assert.equal(junk.id, 'stage-9');
  assert.equal(junk.name, 'Junkyard');
  assert.deepEqual(names, ['Tyre Heaps', 'Scrap Rail', 'Sludge Pit', 'Fridge Row', 'Pipe Bar', 'Wrecking Ball', 'Car Roof', 'Magnet Jump', 'Finish Straight']);
  assert.ok(junk.race && junk.race.finishX > junk.sections[8].x && junk.race.finishX < junk.width);
  assert.ok(junk.race.cues.length >= 10);
  assert.ok(junk.boost);
  assert.equal(junk.palette, 'junk');
  assert.equal(junk.junk, true);
  assert.equal(STAGES.indexOf(junk), 8, 'the stage after Boardwalk');
  assert.notEqual(junk.gameCenter, false, 'has a Game Center board');
  assert.ok(new Game(junk).rival, 'a race has a rival');
});

test('the Junkyard rival is harder than Hellride\'s: quicker, and it eases off less when you fall behind', () => {
  const j = new Rival(Game, junk);
  const h = new Rival(Game, hell);
  const jx = j.game.sk.x;
  const hx = h.game.sk.x;
  assert.ok(j.pace(jx) > h.pace(hx), 'a quicker cruise');
  assert.ok(j.pace(jx - 1e6) > h.pace(hx - 1e6), 'barely slows when you are far behind');
  assert.ok(j.pace(jx + 1e6) <= junk.race.pace + RACE.CATCH_UP_MAX + 1e-9, 'catch-up is still capped');
});

test('the rival rides the whole course clean at every pace the rubber band can give, in about 20 seconds', () => {
  for (const k of [0.97, 1.0, 1.03, 1.08]) {
    const r = new Rival(Game, junk);
    r.pace = () => k;
    r.begin();
    let t = 0;
    while (!r.finished && t < 40) {
      r.update(STEP, 0);
      assert.notEqual(r.game.phase, 'bailed', `pace ${k}: wiped out at x ${Math.round(r.game.sk.x)} (${r.game.bailReason})`);
      t += STEP;
    }
    assert.ok(r.finished, `pace ${k}: never finished`);
    assert.ok(t > 17 && t < 24, `pace ${k}: ${t.toFixed(1)} s`);
  }
});

test('a rider on the rival\'s line at its own pace loses; it takes a clearly quicker line (turbo, manuals) to win', () => {
  assert.equal(race(0.97).game.phase, 'beaten', 'a clean ride at the rival\'s pace is not enough');
  assert.equal(race(1.0).game.phase, 'beaten');
  const win = race(1.08);
  assert.equal(win.game.phase, 'complete');
  assert.ok(win.game.raceResult.won);
});

test('a player who does nothing loses', () => {
  const game = new Game(junk);
  game.tap();
  let t = 0;
  while (t < 45 && game.phase !== 'beaten') {
    game.update(STEP);
    t += STEP;
  }
  assert.equal(game.phase, 'beaten');
  assert.equal(game.raceResult.won, false);
});

test('9-1: the tyre stack is a solid hurdle; a plain ollie clears it', () => {
  assert.equal(play(0, [], 4).g.phase, 'bailed');
  assert.ok(cleared(play(0, [[1.8, 'tap']], 5), 0));
});

test('9-2: lock the scrap rail off the kicker for SCRAP GRIND (and the turbo)', () => {
  const r = play(1, [[0.58, 'tap'], [0.58, 'hold']], 5);
  assert.ok(r.earned.includes('SCRAP GRIND'), JSON.stringify(r.earned));
  assert.ok(cleared(r, 1));
});

test('9-3: rolling into the sludge is a bail; lock the beam across it, or fly it with a charged ollie', () => {
  assert.equal(play(2, [], 4).g.phase, 'bailed');
  const beam = play(2, [[0.5, 'tap'], [0.5, 'hold']], 6);
  assert.ok(beam.earned.includes('SLUDGE GRIND'), JSON.stringify(beam.earned));
  assert.ok(cleared(beam, 2));
  assert.ok(cleared(play(2, [[0, 'cs'], [0.56, 'cr']], 6), 2));
});

test('9-4: ollie the fridge and the washer, or grind a top edge', () => {
  assert.ok(cleared(play(3, [[0.5, 'tap'], [1.7, 'tap']], 6), 3));
  assert.equal(play(3, [], 4).g.phase, 'bailed');
});

test('9-5: grind the pipe bar for PIPE GRIND, or fly it with a charged ollie', () => {
  assert.ok(play(4, [[0.4, 'tap'], [0.4, 'hold']], 5).earned.includes('PIPE GRIND'));
  assert.ok(cleared(play(4, [[0, 'cs'], [0.52, 'cr']], 5), 4));
});

test('9-6: an ollie through the wrecking ball\'s opening pays and leaps the sludge; head above the chain is a bail', () => {
  const ok = play(5, [[0.65, 'tap']], 5);
  assert.ok(ok.earned.includes('WRECKING BALL'), JSON.stringify(ok.earned));
  assert.ok(ok.earned.includes('SLUDGE LEAP'));
  assert.ok(cleared(ok, 5));
  assert.equal(play(5, [[0, 'cs'], [0.75, 'cr']], 5).g.phase, 'bailed', 'a high charged leap hits the ball');
});

test('9-7: ride, grind or fly the wrecked car', () => {
  assert.ok(cleared(play(6, [[0.45, 'tap']], 5), 6));
  assert.ok(play(6, [[0.5, 'tap'], [0.5, 'hold']], 5).earned.includes('CAR GRIND'));
  assert.ok(play(6, [[0, 'cs'], [0.6, 'cr']], 5).earned.includes('CAR LEAP'));
});

test('9-8: lock the arched beam over the pit, or fly it with a charged ollie; a plain ollie falls short', () => {
  assert.equal(play(7, [], 4).g.phase, 'bailed');
  assert.ok(play(7, [[0.5, 'tap'], [0.5, 'hold']], 5).earned.includes('MAGNET GRIND'));
  assert.ok(play(7, [[0, 'cs'], [0.55, 'cr']], 5).earned.includes('MAGNET JUMP'));
  assert.ok(!play(7, [[0.5, 'tap']], 5).earned.includes('MAGNET JUMP'));
});

test('stage 9 has named gap bonuses, each with a distinct id, 300+ points', () => {
  const mine = GAPS.filter((g) => g.stage === 'stage-9');
  assert.ok(mine.length >= 8);
  assert.equal(new Set(mine.map((g) => g.id)).size, mine.length);
  assert.ok(mine.every((g) => g.points >= 300));
});

const stubCtx = { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };

test('the junkyard scene draws at every checkpoint, rival included, with a light hazy sky', () => {
  setPalette('junk');
  const pix = new Pix(stubCtx);
  const r = new Renderer(pix);
  for (let i = 0; i < junk.sections.length; i++) {
    const game = new Game(junk, null, { index: i, score: 0 });
    const cam = Renderer.prototype.camera.call({}, game);
    r.time = 1.3 * i;
    r.drawScene(pix, game, cam);
    let pale = 0;
    for (let p = 0; p < pix.data.length; p += 4) if (pix.data[p] + pix.data[p + 1] + pix.data[p + 2] > 400) pale++;
    assert.ok(pale > pix.w * pix.h * 0.2, `${names[i]}: ${pale} pale pixels`);
  }
  assert.ok(PAL.sky[0] > 150);
  setPalette('normal');
});
