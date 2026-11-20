import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from '../src/render/renderer.js';

// The rival laughs back at the player the first time he pulls ahead in a run.
const track = (r, game) => Renderer.prototype.trackRival.call(r, game);
const fake = (phase, px, rx) => ({ phase, sk: { x: px }, rival: { game: { sk: { x: rx } } } });

test('the first pass starts a laugh, once per run', () => {
  const r = { time: 5, rivalPassed: false, laughUntil: 0, rivalAhead: false };
  track(r, fake('playing', 300, 200)); // still behind
  assert.equal(r.rivalAhead, false);
  assert.equal(r.laughUntil, 0);
  track(r, fake('playing', 300, 400)); // passes
  assert.equal(r.rivalAhead, true);
  assert.ok(r.laughUntil > 5);
  const until = r.laughUntil;
  r.time = 9;
  track(r, fake('playing', 300, 450)); // still ahead: no new first-pass laugh
  assert.equal(r.laughUntil, until);
  track(r, fake('ready', 0, 0)); // a restart rearms it
  track(r, fake('playing', 300, 400));
  assert.ok(r.laughUntil > until);
});

test('he also counts as ahead while you lie in a bail', () => {
  const r = { time: 1, rivalPassed: false, laughUntil: 0, rivalAhead: false };
  track(r, fake('bailed', 300, 500));
  assert.equal(r.rivalAhead, true);
  assert.ok(r.laughUntil > 1);
});
