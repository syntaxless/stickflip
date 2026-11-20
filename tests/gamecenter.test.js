import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../src/stages/index.js';

// Every stage posts to the Game Center board stickflip.stageN (see
// leaderboardFor in src/native.js), so each stage id must be stage-N and none
// may opt out with gameCenter: false.
test('stages 1-10 all have a Game Center board', () => {
  assert.ok(STAGES.length >= 10);
  STAGES.forEach((s, i) => {
    assert.equal(s.id, `stage-${i + 1}`);
    assert.notEqual(s.gameCenter, false, `${s.id} is missing its Game Center board`);
    assert.equal(`stickflip.${s.id.replace(/[^a-z0-9]/gi, '')}`, `stickflip.stage${i + 1}`);
  });
});
