import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localLeaderboard, TABLE_SIZE } from '../src/leaderboard.js';
import { Run } from '../src/run.js';

const memoryStore = () => {
  const data = {};
  return { get: (k, f) => (k in data ? JSON.parse(data[k]) : f), set: (k, v) => (data[k] = JSON.stringify(v)) };
};

test('the table keeps the top 5, best first', async () => {
  assert.equal(TABLE_SIZE, 5);
  const lb = localLeaderboard(memoryStore());
  for (const [i, s] of [100, 500, 300, 900, 200, 700].entries()) await lb.submit(`P${i}`, s);
  assert.deepEqual((await lb.top()).map((e) => e.score), [900, 700, 500, 300, 200]);
});

test('a score qualifies only if it beats the bottom of a full table', async () => {
  const lb = localLeaderboard(memoryStore());
  assert.equal(await lb.qualifies(0), false);
  assert.equal(await lb.qualifies(10), true);
  for (const s of [100, 200, 300, 400, 500]) await lb.submit('AAA', s);
  assert.equal(await lb.qualifies(100), false);
  assert.equal(await lb.qualifies(101), true);
  assert.equal(await lb.submit('ZZZ', 50), -1);
});

test('submit returns the rank, ties go to the earlier score, initials are up to 4 capitals', async () => {
  const lb = localLeaderboard(memoryStore());
  await lb.submit('abc', 300);
  assert.equal(await lb.submit('xyzwq', 300), 1);
  assert.equal(await lb.submit('top', 400), 0);
  assert.deepEqual((await lb.top()).map((e) => e.initials), ['TOP', 'ABC', 'XYZW']);
});

test('a run counts the latest clear of each level, plus the level in progress', () => {
  const run = new Run(3);
  run.recordClear(0, 150);
  run.recordClear(1, 700);
  run.recordClear(0, 300); // rode level 1 again
  assert.equal(run.total(), 1000);
  assert.equal(run.total(2, 250), 1250);
  assert.equal(run.total(1, 0), 300);
  assert.deepEqual(new Run(3, JSON.parse(JSON.stringify(run))).scores, [300, 700, null]);
});
