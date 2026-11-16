// A run is one trip through the levels in order. Each level counts once, with
// the score of your latest clear of it in this run (ride a level again to beat
// your score there), and the run total goes on the leaderboard once the last
// level is done. Bails cost nothing: you just try the level again.

export class Run {
  constructor(levelCount, saved = null) {
    this.scores = Array.from({ length: levelCount }, (_, i) => (saved && Number.isFinite(saved[i]) ? saved[i] : null));
  }

  recordClear(levelIndex, score) {
    this.scores[levelIndex] = score;
  }

  // Run total, with `current` standing in for `levelIndex` (a level in progress).
  total(levelIndex = -1, current = 0) {
    return this.scores.reduce((sum, s, i) => sum + (i === levelIndex ? current : s || 0), 0);
  }

  toJSON() {
    return this.scores;
  }
}
