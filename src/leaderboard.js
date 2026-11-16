// High scores. The game only talks to this small async interface, so the
// on-device version below can later be swapped for one backed by a shared
// database without touching the rest of the code:
//   top()                     -> [{ initials, score, date }] best first (initials: up to 4 letters)
//   qualifies(score)          -> would this score make the table?
//   submit(initials, score)   -> the new entry's rank (0-based), or -1

export const TABLE_SIZE = 5;
export const INITIALS = 4; // letters per name

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
