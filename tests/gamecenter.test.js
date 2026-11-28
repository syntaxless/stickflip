import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../src/stages/index.js';

// Every stage posts to the Game Center board stickflip.stageN (see
// leaderboardFor in src/native.js), so each stage id must be stage-N and none
// may opt out with gameCenter: false. (Stage 11 opts out until its board, stickflip.stage11, exists in App Store
// Connect: delete OPTED_OUT and the flag in stage11.js together.)
const OPTED_OUT = ['stage-11'];
test('stages 1-10 all have a Game Center board', () => {
  assert.ok(STAGES.length >= 10);
  STAGES.forEach((s, i) => {
    assert.equal(s.id, `stage-${i + 1}`);
    if (OPTED_OUT.includes(s.id)) assert.equal(s.gameCenter, false, `${s.id} still opts out`);
    else assert.notEqual(s.gameCenter, false, `${s.id} is missing its Game Center board`);
    assert.equal(`stickflip.${s.id.replace(/[^a-z0-9]/gi, '')}`, `stickflip.stage${i + 1}`);
  });
});
