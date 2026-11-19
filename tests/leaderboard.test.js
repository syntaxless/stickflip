import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localLeaderboard, supabaseLeaderboard, withFallback, cleanInitials, TABLE_SIZE, MAX_SCORE } from '../src/leaderboard.js';
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

test('submit returns the rank, ties go to the earlier score, initials are up to 6 capitals', async () => {
  const lb = localLeaderboard(memoryStore());
  await lb.submit('abc', 300);
  assert.equal(await lb.submit('xyzwqrs', 300), 1);
  assert.equal(await lb.submit('top', 400), 0);
  assert.deepEqual((await lb.top()).map((e) => e.initials), ['TOP', 'ABC', 'XYZWQR']);
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

// A fake Supabase REST endpoint, ordered and limited like the real query.
function fakeSupabase({ fail = false } = {}) {
  const rows = [];
  let n = 0;
  const calls = [];
  const fetchFn = async (url, opts) => {
    calls.push({ url, opts });
    if (fail) throw new TypeError('offline');
    if (opts.method === 'POST') {
      const { initials, score } = JSON.parse(opts.body);
      if (!/^[A-Z ]{1,4}$/.test(initials)) return { ok: false, status: 400 };
      rows.push({ initials, score, created_at: String(n++).padStart(6, '0') });
      return { ok: true, status: 201, json: async () => null };
    }
    const sorted = [...rows].sort((a, b) => b.score - a.score || a.created_at.localeCompare(b.created_at));
    return { ok: true, status: 200, json: async () => sorted.slice(0, 5) };
  };
  return { fetchFn, calls, rows };
}

test('shared table: sends the anon key, cleans initials and returns the rank', async () => {
  const api = fakeSupabase();
  const lb = supabaseLeaderboard({ url: 'https://x.supabase.co/', key: 'anon' }, { fetchFn: api.fetchFn });
  await lb.submit('ab', 300);
  assert.equal(await lb.submit('c-d1', 500), 0);
  assert.equal(await lb.submit('ZED', 300), 2, 'a tie ranks after the earlier score');
  assert.deepEqual((await lb.top()).map((e) => [e.initials, e.score]), [['CD', 500], ['AB', 300], ['ZED', 300]]);
  const post = api.calls.find((c) => c.opts.method === 'POST');
  assert.equal(post.url, 'https://x.supabase.co/rest/v1/scores');
  assert.equal(post.opts.headers.apikey, 'anon');
  assert.equal(await lb.qualifies(1), true);
});

test('fallback: the device table is used when the shared one is unreachable', async () => {
  const local = localLeaderboard(memoryStore());
  const lb = withFallback(supabaseLeaderboard({ url: 'https://x', key: 'k' }, { fetchFn: fakeSupabase({ fail: true }).fetchFn }), local);
  assert.equal(await lb.submit('AL', 400), 0);
  assert.deepEqual((await lb.top()).map((e) => e.score), [400]);
  assert.equal(await lb.qualifies(10), true);
});

test('fallback: scores are kept on the device even when the shared table works', async () => {
  const local = localLeaderboard(memoryStore());
  const api = fakeSupabase();
  const lb = withFallback(supabaseLeaderboard({ url: 'https://x', key: 'k' }, { fetchFn: api.fetchFn }), local);
  await lb.submit('AL', 400);
  assert.equal(api.rows.length, 1);
  assert.deepEqual((await local.top()).map((e) => e.score), [400]);
});

test('initials are cleaned to 1-6 letters', () => {
  assert.equal(cleanInitials('a.b-c'), 'ABC');
  assert.equal(cleanInitials('   '), 'ANON');
  assert.equal(cleanInitials('LONGNAME'), 'LONGNA');
});

test('a run with no bails earns the clean-run bonus; one bail loses it, and it survives a save', async () => {
  const { CLEAN_RUN_BONUS } = await import('../src/run.js');
  const run = new Run(3);
  assert.equal(run.bonus(), CLEAN_RUN_BONUS);
  const saved = new Run(3, JSON.parse(JSON.stringify(run)));
  assert.equal(saved.bonus(), CLEAN_RUN_BONUS);
  run.recordBail();
  assert.equal(run.bonus(), 0);
  assert.equal(new Run(3, JSON.parse(JSON.stringify(run))).bonus(), 0);
  assert.equal(new Run(3, [100, null, null]).bonus(), 0, 'an old save (scores only) is not proof of a clean run');
});

test('a stage board reads and writes only its own stage', async () => {
  const calls = [];
  const fetchFn = async (url, opts = {}) => {
    calls.push({ url, body: opts.body });
    return { ok: true, json: async () => [] };
  };
  const lb = supabaseLeaderboard({ url: 'https://x', key: 'k' }, { stage: 'stage-2', fetchFn });
  await lb.top();
  await lb.submit('ABC', 500);
  assert.ok(calls[0].url.includes('stage=eq.stage-2'));
  assert.deepEqual(JSON.parse(calls[1].body), { initials: 'ABC', score: 500, stage: 'stage-2' });
});

test('six-digit scores are sent as they are (the database limit is far above them)', async () => {
  const bodies = [];
  const fetchFn = async (url, opts = {}) => {
    if (opts.body) bodies.push(JSON.parse(opts.body));
    return { ok: true, json: async () => [] };
  };
  const lb = supabaseLeaderboard({ url: 'https://x', key: 'k' }, { fetchFn });
  await lb.submit('ABC', 160198);
  await lb.submit('ABC', MAX_SCORE * 5);
  assert.equal(bodies[0].score, 160198);
  assert.equal(bodies[1].score, MAX_SCORE);
  assert.ok(MAX_SCORE > 160198);
});
