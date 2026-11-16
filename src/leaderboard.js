// High scores. The game only talks to this small async interface, so the
// on-device version below can later be swapped for one backed by a shared
// database without touching the rest of the code:
//   top()                     -> [{ initials, score, date }] best first (initials: up to INITIALS letters)
//   qualifies(score)          -> would this score make the table?
//   submit(initials, score)   -> the new entry's rank (0-based), or -1

export const TABLE_SIZE = 5;
export const INITIALS = 6; // letters per name (the database allows up to 6: see supabase/scores.sql)

// `store` is any { get(key, fallback), set(key, value) } (localStorage in the
// browser, a plain object in tests).
export function localLeaderboard(store, key = 'highscores', size = TABLE_SIZE) {
  const read = () => {
    const list = store.get(key, []);
    return Array.isArray(list) ? list : [];
  };
  return {
    async top() {
      return read().slice(0, size);
    },
    async qualifies(score) {
      const list = read();
      return score > 0 && (list.length < size || score > list[size - 1].score);
    },
    async submit(initials, score) {
      const entry = { initials: String(initials).toUpperCase().slice(0, INITIALS), score, date: new Date().toISOString() };
      // Ties go to whoever got there first.
      const list = read();
      let rank = list.findIndex((e) => score > e.score);
      if (rank === -1) rank = list.length;
      if (rank >= size) return -1;
      list.splice(rank, 0, entry);
      store.set(key, list.slice(0, size));
      return rank;
    },
  };
}

// Letters A-Z and spaces only, at most INITIALS of them (the database checks this too).
export function cleanInitials(initials) {
  const s = String(initials).toUpperCase().replace(/[^A-Z ]/g, '').slice(0, INITIALS);
  return s.trim() ? s : 'ANON'.slice(0, INITIALS);
}

// A shared table in Supabase, reached through its REST API with the public
// anon key. The table's row level security only allows reading and adding
// scores (see the setup SQL). Calls throw when offline, slow or refused.
export function supabaseLeaderboard({ url, key }, { size = TABLE_SIZE, fetchFn = (...a) => fetch(...a), timeoutMs = 5000 } = {}) {
  const base = `${url.replace(/\/+$/, '')}/rest/v1/scores`;
  // New-style publishable keys (sb_publishable_...) go in the apikey header
  // only; legacy anon keys are JWTs and are also sent as the bearer token.
  const authHeaders = key.startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
  async function call(query, opts = {}) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl && setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchFn(base + query, {
        ...opts,
        headers: { ...authHeaders, 'Content-Type': 'application/json', ...opts.headers },
        signal: ctl?.signal,
      });
      if (!res.ok) throw new Error(`scores: HTTP ${res.status}`);
      return res;
    } finally {
      clearTimeout(timer);
    }
  }
  async function top() {
    const res = await call(`?select=initials,score,created_at&order=score.desc,created_at.asc&limit=${size}`);
    return (await res.json()).map((e) => ({ initials: e.initials, score: e.score, date: e.created_at }));
  }
  return {
    top,
    async qualifies(score) {
      const list = await top();
      return score > 0 && (list.length < size || score > list[size - 1].score);
    },
    async submit(initials, score) {
      const name = cleanInitials(initials);
      await call('', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ initials: name, score }) });
      const list = await top();
      // The newest matching row ranks last among equal scores, so take the last match.
      for (let i = list.length - 1; i >= 0; i--) if (list[i].initials === name && list[i].score === score) return i;
      return -1;
    },
  };
}

// The shared table when it answers, the on-device one when it doesn't
// (offline, blocked, rate limited). Scores are always kept on the device too.
export function withFallback(remote, local) {
  return {
    async top() {
      try {
        return await remote.top();
      } catch {
        return local.top();
      }
    },
    async qualifies(score) {
      try {
        return await remote.qualifies(score);
      } catch {
        return local.qualifies(score);
      }
    },
    async submit(initials, score) {
      const rank = await local.submit(cleanInitials(initials), score);
      try {
        return await remote.submit(initials, score);
      } catch {
        return rank;
      }
    },
  };
}
