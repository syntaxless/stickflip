import { RACE } from './config.js';

// The computer-controlled rival in a race level (Hellride). It is a second
// Game on the very same course, so it follows every rule the player does: the
// same physics, rails and turbo kicks, and it falls in the lava if it misses.
// Its "thumb" is a list of cues laid down with the level (level.race.cues): when
// the rival reaches a cue's x it does that one thing, as a finger would.
//
//   { x, act: 'tap' }                   a tap: ollie on the ground, lock a grind
//                                        (or flip) in the air, pop off a rail
//   { x, act: 'hold', for: 0.5 }        crouch for that many seconds, then pop
//                                        (a charged ollie: it flies further)
//   { x, act: 'swipe', key: 'kickflip' } a trick in the air (a TRICKS key)
//   { x, act: 'lock' }                  tap to lock a grind the moment a rail is about to be
//                                        under it (it watches the rail come, like a player), if
//                                        one comes before x + 300 (or `within`); it follows on
//                                        from the cue before it, which should be the ollie
//
// A cue is where the finger goes down, in strip coordinates, or (with `lead`) a time before
// reaching x: `{ x: 1200, lead: 0.3, act: 'tap' }` taps 0.3 s before the rival gets to x, whatever
// its speed (a jump's length grows with speed too, so the same cue works a little faster or
// slower). compose.js shifts a section's cues along with it; tests/race.test.js rides the whole
// course at the range of paces the rubber band can give, and scripts/solve-rival.mjs finds cues.

export class Rival {
  constructor(GameClass, level) {
    this.level = level;
    this.cues = [...(level.race.cues || [])].sort((a, b) => a.x - b.x);
    this.game = new GameClass(level, null, null, { rival: true });
    this.place({ index: 0, score: 0 });
  }

  // Back on the starting line of section `cp.index`, waiting for the race to begin.
  place(cp) {
    const g = this.game;
    g.checkpoint = { index: cp.index, score: 0 };
    g.reset();
    g.sk.x -= RACE.START_GAP; // in the lane behind
    g.sk.y = g.groundAt(g.sk.x).y;
    this.running = false;
    this.finished = false;
    this.release = null; // game time to let go of a held crouch
    this.lock = null; // { until } a 'lock' cue waiting for its rail
    this.down = 0; // seconds spent lying after a bail
    this.rewind();
  }

  // The next cue is the first one still ahead of the rival.
  rewind() {
    const x = this.game.sk.x;
    this.next = this.cues.findIndex((c) => c.x >= x + (c.lead ? this.game.speed * c.lead : 0));
    if (this.next < 0) this.next = this.cues.length;
  }

  get x() {
    return this.game.sk.mode === 'bail' && this.game.sk.bail ? this.game.sk.bail.x : this.game.sk.x;
  }

  begin() {
    if (this.running || this.finished) return;
    this.running = true;
    this.game.tap(); // ready -> rolling
  }

  // Rival pace from the gap to the player (`playerX`): a little quicker than cruising, quicker
  // still when the player is ahead, easing off when the player has fallen behind.
  pace(playerX) {
    const d = playerX - this.game.sk.x; // > 0: the player is ahead
    let k = RACE.RIVAL_PACE;
    if (d > 0) k += Math.min(RACE.CATCH_UP_MAX, d * RACE.CATCH_UP);
    else k -= Math.min(RACE.EASE_OFF_MAX, -d * RACE.EASE_OFF);
    return k;
  }

  update(dt, playerX) {
    const g = this.game;
    if (this.finished) return;
    if (g.phase === 'bailed') {
      // wiped out: lie there a moment, then back on the board at the start of the section
      this.down += dt;
      if (this.down >= RACE.WIPEOUT_DELAY) {
        this.down = 0;
        g.reset();
        g.start(true);
        this.release = null;
        this.lock = null;
        this.rewind();
      } else g.update(dt);
      g.events.length = 0;
      return;
    }
    if (g.phase !== 'playing') return;
    g.cruise = g.baseSpeed * this.pace(playerX);
    const now = g.time;
    if (this.release && now >= this.release) {
      this.release = null;
      g.releaseCharge();
      g.setHold(false);
    }
    while (this.next < this.cues.length && g.wait <= 0 && this.due(this.cues[this.next])) this.fire(this.cues[this.next++]);
    if (this.lock) {
      if (g.sk.x > this.lock.until || g.sk.mode === 'grind') this.lock = null;
      else if (g.sk.mode === 'air' && g.grindHint() === 'ready') {
        this.lock = null;
        g.tap();
      }
    }
    g.update(dt);
    g.events.length = 0; // nothing draws the rival's popups or plays its sounds
    if (g.phase === 'complete') this.finished = true;
  }

  // A cue is due when the rival gets to its x (less `lead` seconds of riding at the current speed);
  // a 'lock' follows straight on from the cue before it.
  due(cue) {
    if (cue.act === 'lock') return true;
    const g = this.game;
    if ((cue.act === 'tap' || cue.act === 'hold') && g.sk.mode !== 'roll') return false; // an ollie needs the ground: wait to land
    return g.sk.x >= cue.x - (cue.lead ? g.speed * cue.lead : 0);
  }

  fire(cue) {
    const g = this.game;
    if (cue.act === 'hold') {
      g.setHold(true);
      g.startCharge();
      this.release = g.time + (cue.for ?? 0.4);
    } else if (cue.act === 'lock') this.lock = { until: cue.x + (cue.within ?? 300) };
    else if (cue.act === 'swipe') g.swipe(cue.key);
    else g.tap();
  }

  // How long until the rival gets to `finishX`, at the speed it is going: the lead the player
  // had on crossing the line (for the win bonus).
  secondsBehind(finishX) {
    const g = this.game;
    return Math.max(0, (finishX - g.sk.x) / Math.max(1, g.speed));
  }
}
