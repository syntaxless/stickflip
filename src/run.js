// A run is one trip through the levels in order. Each level counts once, with
// the score of your latest clear of it in this run, and the run total goes on
// the leaderboard once the last level is done. A bail costs nothing but the
// no-bail bonus: you just try the level again.

// Added to the run total for getting through every level without a single bail.
export const CLEAN_RUN_BONUS = 2000;

export class Run {
  // `saved` is what toJSON() gave: { scores, clean }, or (older saves) just the
  // scores array, which can't prove a clean run.
  constructor(levelCount, saved = null) {
    const scores = Array.isArray(saved) ? saved : saved?.scores;
    this.scores = Array.from({ length: levelCount }, (_, i) => (scores && Number.isFinite(scores[i]) ? scores[i] : null));
    this.clean = saved ? !Array.isArray(saved) && saved.clean === true : true;
  }

  recordClear(levelIndex, score) {
    this.scores[levelIndex] = score;
  }

  recordBail() {
    this.clean = false;
  }

  bonus() {
    return this.clean ? CLEAN_RUN_BONUS : 0;
  }

  // Run total, with `current` standing in for `levelIndex` (a level in progress).
  total(levelIndex = -1, current = 0) {
    return this.scores.reduce((sum, s, i) => sum + (i === levelIndex ? current : s || 0), 0);
  }

  toJSON() {
    return { scores: this.scores, clean: this.clean };
  }
}
