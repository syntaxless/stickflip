import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { Rival } from '../src/rival.js';
import { STAGES } from '../src/stages/index.js';
import { RACE, BOOST, PHYS } from '../src/config.js';

// Hellride: a race against a computer rival on the same course.

const STEP = 1 / 120;
const hell = STAGES[5];
const W = 960;

// A bot that rides a game by the rival's own cues (the rival's line), at a fixed pace.
function botFor(game, pace) {
  const bot = new Rival(Game, hell);
  bot.game = game;
  bot.pace = () => pace;
  bot.running = true;
  bot.next = 0;
  return bot;
}

// Races until the race is decided. `player`: null (stand still after the start tap) or a bot pace.
function race(player, tmax = 40) {
  const game = new Game(hell);
  game.tap();
  const bot = player ? botFor(game, player) : null;
  let t = 0;
  while (t < tmax && game.phase !== 'complete' && game.phase !== 'beaten') {
    if (bot) bot.update(STEP, 0);
    else game.update(STEP);
    if (bot && game.phase === 'bailed') break; // (a bot that bails has failed; a player who does nothing just lies there while the rival wins)
    t += STEP;
  }
  return { game, t };
}

test('Hellride is stage 6: a race over eight and a bit sections, with a finish line and a rival with cues', () => {
  assert.equal(hell.id, 'stage-6');
  assert.equal(hell.name, 'Hellride');
  assert.equal(hell.sections.length, 9);
  assert.ok(hell.race.finishX > hell.sections[8].x && hell.race.finishX < hell.width);
  assert.ok(hell.race.cues.length >= 10);
  for (const c of hell.race.cues) assert.ok(c.x >= 0 && c.x <= hell.width, 'cue inside the stage');
  const g = new Game(hell);
  assert.ok(g.rival, 'a race has a rival');
  assert.equal(new Game(STAGES[4]).rival, null, 'other stages have none');
});

test('the rival rides the whole course clean at every pace the rubber band can give, in about 20 seconds', () => {
  for (const k of [0.93, 0.97, 1.0, 1.04, 1.08]) {
    const r = new Rival(Game, hell);
    r.pace = () => k;
    r.begin();
    let t = 0;
    while (!r.finished && t < 40) {
      r.update(STEP, 0);
      assert.notEqual(r.game.phase, 'bailed', `pace ${k}: wiped out at x ${Math.round(r.game.sk.x)} (${r.game.bailReason})`);
      t += STEP;
    }
    assert.ok(r.finished, `pace ${k}: never finished`);
    assert.ok(t > 17 && t < 23, `pace ${k}: ${t.toFixed(1)} s`);
  }
});

test('the rival follows the same rules: the turbo from a grind, and it can fall in the lava', () => {
  const r = new Rival(Game, hell);
  r.pace = () => 1;
  r.begin();
  let top = 0;
  while (!r.finished && r.game.sk.x < 2 * W) {
    r.update(STEP, 0);
    top = Math.max(top, r.game.speed);
  }
  assert.ok(top > r.game.baseSpeed * 1.2, `top speed ${Math.round(top)}: the rail kicked the turbo in`);
  // no cues at all: it rolls into the first block and wipes out, then is back on its board after a moment
  const lost = new Rival(Game, { ...hell, race: { ...hell.race, cues: [] } });
  lost.begin();
  let bailed = false;
  for (let t = 0; t < 20; t += STEP) {
    lost.update(STEP, 0);
    if (lost.game.phase === 'bailed') bailed = true;
    if (bailed && lost.game.phase === 'playing') break;
  }
  assert.ok(bailed, 'wiped out on the first obstacle');
  assert.equal(lost.game.phase, 'playing', 'and is back at it after the wipeout delay');
  assert.ok(lost.game.sk.x >= hell.sections[0].x + PHYS.START_X - 1);
});

test('rival pace: a touch under your cruise, quicker when you pull ahead, easing off when you fall behind', () => {
  const r = new Rival(Game, hell);
  const x = r.game.sk.x;
  assert.equal(r.pace(x), RACE.RIVAL_PACE);
  assert.ok(r.pace(x + 200) > RACE.RIVAL_PACE, 'player ahead: rival speeds up');
  assert.ok(r.pace(x + 1e6) <= RACE.RIVAL_PACE + RACE.CATCH_UP_MAX + 1e-9, 'capped');
  assert.ok(r.pace(x - 300) < RACE.RIVAL_PACE, 'player behind: rival eases off');
  assert.ok(r.pace(x - 1e6) >= RACE.RIVAL_PACE - RACE.EASE_OFF_MAX - 1e-9, 'capped');
});

test('the rival starts when you do, lined up a little behind, and not before', () => {
  const g = new Game(hell);
  const r = g.rival;
  assert.equal(r.running, false);
  assert.equal(r.game.sk.x, hell.sections[0].x + PHYS.START_X - RACE.START_GAP);
  for (let i = 0; i < 60; i++) g.update(STEP); // standing at the start line
  assert.equal(r.game.phase, 'ready');
  g.tap();
  assert.equal(r.running, true);
  for (let i = 0; i < 120; i++) g.update(STEP);
  assert.ok(r.game.sk.x > hell.sections[0].x + PHYS.START_X, 'rolling');
});

test('a player who does nothing loses: the rival crosses the line first and the tap races again from the start', () => {
  const { game, t } = race(null);
  assert.equal(game.phase, 'beaten', `phase ${game.phase}`);
  assert.ok(game.rival.finished);
  assert.equal(game.raceResult.won, false);
  assert.ok(t > 15 && t < 35, `${t.toFixed(1)} s (the rival eases off while you are far behind)`);
  // (a player who does nothing bails into the first block, so this is the bailed-then-beaten path)
});

test('the rival keeps racing while you are bailed, and winning while bailed is still a loss', () => {
  const g = new Game(hell);
  g.tap();
  for (let i = 0; i < 2 * 120; i++) g.update(STEP);
  const before = g.rival.x;
  g.bail('slam');
  for (let i = 0; i < 3 * 120; i++) g.update(STEP);
  assert.equal(g.phase, 'bailed');
  assert.ok(g.rival.x > before + 500, 'the rival rode on');
  // retrying leaves the rival where it is (it is not reset)
  const x = g.rival.x;
  g.tap();
  assert.equal(g.phase, 'playing');
  assert.ok(g.rival.x >= x, 'the rival was not reset by a retry');
  assert.equal(g.rival.running, true);
});

test('a tap after losing races again from the very start: both riders back on the line, score gone', () => {
  const { game } = race(null);
  assert.equal(game.phase, 'beaten');
  game.tap(); // too soon
  assert.equal(game.phase, 'beaten');
  for (let i = 0; i < 120; i++) game.update(STEP);
  game.tap();
  assert.equal(game.phase, 'playing');
  assert.equal(game.checkpoint.index, 0);
  assert.equal(game.score, 0);
  assert.equal(game.rival.finished, false);
  assert.equal(game.rival.game.sk.x, hell.sections[0].x + PHYS.START_X - RACE.START_GAP);
  assert.equal(game.raceResult, null);
});

test('riding the rival\'s own line cleanly wins by a little, with the win bonus on top', () => {
  const { game } = race(1.0);
  assert.equal(game.phase, 'complete', `phase ${game.phase}`);
  assert.equal(game.raceResult.won, true);
  const { lead, bonus } = game.raceResult;
  assert.ok(lead > 0.1 && lead < 3, `lead ${lead}`);
  assert.equal(bonus, RACE.WIN_BONUS + Math.round(lead * RACE.LEAD_BONUS));
  assert.ok(game.score >= bonus, 'the bonus is in the score');
});

test('a sloppy line (no better than the rival\'s pace) is a photo finish that can go either way', () => {
  const { game } = race(0.95);
  assert.ok(['complete', 'beaten'].includes(game.phase), game.phase);
  if (game.phase === 'complete') assert.ok(game.raceResult.lead < 0.6);
});

test('the finish line ends the race wherever the rider is: in the air counts', () => {
  const g = new Game(hell, null, { index: 8, score: 0 });
  g.rival = null;
  g.tap();
  g.sk.x = hell.race.finishX - 5;
  g.sk.y = 300;
  g.sk.mode = 'air';
  g.sk.vy = 0;
  g.sk.vx = 330;
  for (let i = 0; i < 30 && g.phase === 'playing'; i++) g.update(STEP);
  assert.equal(g.phase, 'complete');
});

test('turbo (levels with `boost`): locking a grind, a ring of fire and a named gap kick the speed up; other stages do not', () => {
  const grind = (stage, section, acts) => {
    const g = new Game(stage, null, { index: section, score: 0 });
    g.rival = null;
    g.tap();
    const q = [...acts];
    let top = g.speed;
    const ev = [];
    for (let t = 0; t < 3; t += STEP) {
      while (q.length && q[0][0] <= t) {
        const [, k] = q.shift();
        if (k === 'tap') g.tap();
        else g.setHold(true);
      }
      g.update(STEP);
      ev.push(...g.drainEvents());
      top = Math.max(top, g.speed);
    }
    return { g, top, ev };
  };
  const a = grind(hell, 4, [[0.41, 'tap'], [0.41, 'hold']]); // the Bone Bar
  assert.ok(a.ev.some((e) => e.type === 'boost'), 'a boost event');
  assert.ok(a.top >= a.g.baseSpeed * (1 + BOOST.GRIND) - 1, `top ${Math.round(a.top)}`);
  assert.ok(a.top <= a.g.cruise * PHYS.SPEED_MAX + 1, 'never past the usual top speed');
  // the same bar in Stage 5 (the Flat Bar) is just a rail: no turbo
  const b = grind(STAGES[4], 1, [[0.41, 'tap'], [0.41, 'hold']]);
  assert.ok(!b.ev.some((e) => e.type === 'boost'));
  assert.ok(b.top <= b.g.baseSpeed + 1e-6);
});

test('the turbo fades slowly back to cruising speed (Hellride\'s speedReturn)', () => {
  const g = new Game(hell, null, { index: 4, score: 0 });
  g.rival = null;
  g.tap();
  g.boost(BOOST.GRIND);
  const kicked = g.speed;
  assert.ok(kicked > g.baseSpeed * 1.2);
  for (let t = 0; t < 1; t += STEP) g.update(STEP);
  const after = g.speed;
  assert.ok(after < kicked && after > kicked - 50, `eased ${Math.round(kicked)} -> ${Math.round(after)} in 1 s`);
  for (let t = 0; t < 4; t += STEP) g.update(STEP);
  assert.ok(Math.abs(g.speed - g.baseSpeed) < 2 || g.phase !== 'playing', 'back to cruising in a few seconds');
});

test('a ring of fire: through the opening is a bonus and a turbo, above it is a bail, under it is nothing', () => {
  const ring = hell.obstacles.find((o) => o.type === 'fire-ring');
  assert.ok(ring);
  const h = ring.hazards[0];
  const mk = (head) => {
    const g = new Game(hell, null, { index: 5, score: 0 });
    g.rival = null;
    g.tap();
    g.sk.mode = 'air';
    g.sk.x = h.x - 3;
    g.sk.y = head + 60; // head is 60 above the feet
    g.sk.vx = 330;
    g.sk.vy = 0;
    g.drainEvents();
    g.update(STEP * 2);
    return g;
  };
  const through = mk((h.top + h.bottom) / 2);
  assert.ok(through.combo.some((t) => t.name === 'FIRE RING'));
  assert.ok(through.speed > through.baseSpeed);
  assert.equal(mk(h.top - 30).phase, 'bailed');
  assert.equal(mk(h.bottom + 30).combo.length, 0);
});

test('lava is a gap: falling in is a bail with a splash of embers', async () => {
  const pit = hell.obstacles.find((o) => o.type === 'lava');
  assert.ok(pit.splash && pit.splash.kind === 'lava');
  const g = new Game(hell, null, { index: 2, score: 0 });
  g.rival = null;
  g.tap();
  for (let t = 0; t < 3 && g.phase === 'playing'; t += STEP) g.update(STEP); // rolls into the moat
  assert.equal(g.phase, 'bailed');
  assert.equal(g.bailReason, 'rolled'); // (rolling in; ollie short and it is 'gap')
});

test('the renderer draws Hellride (sky, rival, race bar, lose and ready screens) without throwing', async () => {
  const { Renderer } = await import('../src/render/renderer.js');
  const cells = new Map();
  const fb = {
    w: 320,
    h: 180,
    ox: 0,
    oy: 0,
    data: null,
    fill() {},
    pset() {},
    line() {},
    rect() {},
    circle() {},
    text() {},
    textWidth: (s) => s.length * 6,
    clear() {},
    flush() {},
  };
  const rd = new Renderer(fb);
  const g = new Game(hell);
  rd.draw(g, 1 / 60, {});
  g.tap();
  for (let i = 0; i < 6 * 120; i++) {
    g.update(STEP);
    if (i % 4 === 0) {
      rd.consume(g.drainEvents(), g);
      rd.draw(g, 1 / 30, { total: g.score });
    }
  }
  const lost = race(null).game;
  rd.draw(lost, 1 / 60, {});
  assert.ok(cells);
});

// The rival has his say once the race is decided (renderer.js draws the bubble).
test('the rival says "YOU LOSE!" when he wins and "HOW‽" when he loses, and nothing mid-race', async () => {
  const { rivalWords: say } = await import('../src/render/renderer.js');
  const { glyph } = await import('../src/render/pixel.js');
  assert.equal(say(new Game(hell)), null, 'before the start');
  const lost = race(null).game;
  assert.equal(lost.phase, 'beaten');
  assert.equal(say(lost), 'YOU LOSE!');
  const won = race(1.0).game;
  assert.equal(won.phase, 'complete');
  assert.equal(say(won), 'HOW‽');
  assert.equal(say(new Game(STAGES[4])), null, 'no rival, no bubble');
  assert.notEqual(glyph('‽'), glyph('?'), 'the pixel font has its own interrobang');
});
