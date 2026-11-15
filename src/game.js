import { WORLD, PHYS, SCORE, TRICKS } from './config.js';

// Game logic for one level: skater physics, the one-button control scheme and
// scoring. It never touches the DOM, so it runs in tests as well as the browser.
//
// Phases:  ready -> playing -> (bailed | complete)
// Skater modes while playing: roll, air, grind
//
// One input, "tap", means whatever makes sense right now:
//   rolling        -> ollie
//   in the air     -> kickflip, or lock a grind if a rail is less than
//                     PHYS.GRIND_WINDOW seconds away (tap any earlier and it's a kickflip)
//   grinding       -> pop off the rail (and you can flip again on the way down)
//
// Swipes in the air do the other tricks (see TRICKS in config.js). A swipe
// anywhere else acts like a tap, so it can never get you stuck.

export const BAIL_MESSAGES = {
  slam: 'SLAMMED THE RAIL. OLLIE EARLIER!',
  clipped: 'CLIPPED THE RAIL. TAP JUST BEFORE IT!',
  flip: 'LANDED MID-TRICK. START IT EARLIER!',
};

export class Game {
  constructor(level) {
    this.level = level;
    this.surfaces = level.obstacles.flatMap((o) => o.surfaces);
    this.solids = level.obstacles.flatMap((o) => o.solids);
    this.reset();
  }

  reset() {
    this.phase = 'ready';
    this.phaseTime = 0;
    this.time = 0;
    this.score = 0;
    this.combo = []; // tricks done since leaving the ground: { name, points }
    this.events = []; // for the renderer: popups, sparks, sounds
    this.bailReason = null;
    this.stars = 0;
    this.sk = {
      x: PHYS.START_X,
      y: WORLD.GROUND,
      vx: 0,
      vy: 0,
      mode: 'idle',
      support: null, // landable surface being rolled on (null = ground)
      flip: null, // { t, key, trick } while an air trick is in progress
      primed: false, // ready to lock a grind on contact
      grind: null, // { surface, dist }
      bail: null, // ragdoll state after a bail
    };
  }

  setPhase(phase) {
    this.phase = phase;
    this.phaseTime = 0;
  }

  emit(type, data = {}) {
    this.events.push({ type, x: this.sk.x, y: this.sk.y, ...data });
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ---------------------------------------------------------------- input

  tap() {
    switch (this.phase) {
      case 'ready':
        this.start();
        break;
      case 'playing':
        this.skaterTap();
        break;
      case 'bailed':
        if (this.phaseTime >= PHYS.BAIL_RETRY_DELAY) {
          this.reset();
          this.start();
        }
        break;
      // 'complete' taps are handled by the UI buttons.
    }
  }

  start() {
    this.setPhase('playing');
    this.sk.mode = 'roll';
    this.sk.vx = PHYS.ROLL_SPEED;
    this.emit('push');
  }

  skaterTap() {
    const s = this.sk;
    if (s.mode === 'roll') {
      this.takeOff(PHYS.OLLIE_V);
    } else if (s.mode === 'grind') {
      this.endGrind();
      this.takeOff(PHYS.POP_V);
    } else if (s.mode === 'air') {
      this.airTap();
    }
  }

  takeOff(speed) {
    const s = this.sk;
    s.mode = 'air';
    s.vy = -speed;
    s.vx = PHYS.ROLL_SPEED;
    s.support = null;
    s.primed = false;
    this.emit('pop');
  }

  // A swipe: 'up' | 'down' | 'left' | 'right' or a pattern like 'down-right'.
  swipe(dir) {
    if (this.phase !== 'playing' || this.sk.mode !== 'air') return this.tap();
    const key = TRICKS[dir] ? dir : dir.split('-')[0];
    if (!TRICKS[key]) return this.airTap();
    const s = this.sk;
    if (s.flip || s.primed) return; // one thing at a time: input during a trick is ignored
    this.startTrick(key);
  }

  airTap() {
    const s = this.sk;
    if (s.flip || s.primed) return;
    if (this.grindHint() === 'ready') {
      s.primed = true;
      this.emit('prime');
    } else {
      this.startTrick('tap');
    }
  }

  startTrick(key) {
    this.sk.flip = { t: 0, key, trick: TRICKS[key] };
    this.emit('flip', { key });
  }

  // ------------------------------------------------------------ prediction

  // Where (and how soon) the skater will touch down on the current arc.
  predictContact() {
    const s = this.sk;
    const g = PHYS.GRAVITY;
    const timeToY = (y) => (-s.vy + Math.sqrt(s.vy * s.vy + 2 * g * (y - s.y))) / g;
    let best = null;
    for (const surf of this.surfaces) {
      if (surf.y <= s.y + 0.5) continue; // already at or below this top
      const t = timeToY(surf.y);
      const xHit = s.x + s.vx * t;
      if (xHit >= surf.x1 && xHit <= surf.x2 && (!best || t < best.t)) {
        best = { t, surface: surf };
      }
    }
    return best || { t: timeToY(WORLD.GROUND), surface: null };
  }

  // 'ready'  -> a tap right now would lock a grind
  // 'primed' -> a grind is locked in for the coming contact (or grinding)
  // null     -> nothing to grind
  grindHint() {
    const s = this.sk;
    if (this.phase !== 'playing') return null;
    if (s.mode === 'grind' || s.primed) return 'primed';
    if (s.mode !== 'air' || s.flip) return null;
    const c = this.predictContact();
    if (c.surface && c.surface.grindable && c.t <= PHYS.GRIND_WINDOW) return 'ready';
    return null;
  }

  // ------------------------------------------------------------- update

  update(dt) {
    this.time += dt;
    this.phaseTime += dt;
    const s = this.sk;

    if (this.phase === 'ready') return;
    if (this.phase === 'bailed') return this.updateBail(dt);
    if (this.phase === 'complete') {
      s.x += s.vx * dt; // roll on off-screen
      return;
    }

    if (s.mode === 'roll') {
      s.x += s.vx * dt;
      if (s.support && s.x > s.support.x2) {
        s.mode = 'air';
        s.vy = 0;
        s.support = null;
      }
      if (this.hitSolid()) return this.bail('slam');
      if (s.x > PHYS.EXIT_X) return this.finish();
    } else if (s.mode === 'grind') {
      const step = PHYS.GRIND_SPEED * dt;
      s.x += step;
      s.grind.dist += step;
      if (s.x > s.grind.surface.x2) {
        this.endGrind();
        s.mode = 'air';
        s.vy = 0;
      }
    } else if (s.mode === 'air') {
      this.updateAir(dt);
    }
  }

  updateAir(dt) {
    const s = this.sk;
    const prevY = s.y;
    s.vy += PHYS.GRAVITY * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;

    if (s.flip) {
      s.flip.t += dt;
      const { trick } = s.flip;
      if (s.flip.t >= trick.dur) {
        s.flip = null;
        this.addTrick(trick.name, trick.points);
      }
    }

    // Touching the top of an obstacle from above.
    for (const surf of this.surfaces) {
      if (prevY <= surf.y + 0.01 && s.y >= surf.y && s.x >= surf.x1 && s.x <= surf.x2) {
        s.y = surf.y;
        if (surf.grindable && s.primed) return this.startGrind(surf);
        if (s.flip) return this.bail('flip');
        if (surf.landable) return this.land(surf);
        return this.bail('clipped');
      }
    }

    if (s.y >= WORLD.GROUND) {
      s.y = WORLD.GROUND;
      if (s.flip) return this.bail('flip');
      return this.land(null);
    }

    if (this.hitSolid()) return this.bail('slam');
  }

  hitSolid() {
    const s = this.sk;
    for (const r of this.solids) {
      const inX = (px) => px > r.x && px < r.x + r.w;
      if (s.y > r.y + 6 && s.y <= r.y + r.h + 1 && (inX(s.x) || inX(s.x + PHYS.NOSE))) return true;
    }
    return false;
  }

  // ------------------------------------------------------------ tricks

  addTrick(name, points) {
    this.combo.push({ name, points });
    this.emit('trick', { name, points });
  }

  startGrind(surface) {
    const s = this.sk;
    s.mode = 'grind';
    s.vy = 0;
    s.y = surface.y;
    s.primed = false;
    s.grind = { surface, dist: 0 };
    this.emit('grind');
  }

  endGrind() {
    const s = this.sk;
    const { surface, dist } = s.grind;
    s.grind = null;
    this.addTrick(surface.trick, SCORE.GRIND_BASE + Math.round(dist * SCORE.GRIND_PER_PX));
  }

  land(surface) {
    const s = this.sk;
    s.mode = 'roll';
    s.vy = 0;
    s.support = surface;
    s.y = surface ? surface.y : WORLD.GROUND;
    s.primed = false;
    this.emit('land');
    this.bankCombo();
  }

  bankCombo() {
    if (!this.combo.length) return;
    const sum = this.combo.reduce((a, t) => a + t.points, 0);
    const mult = this.combo.length;
    const total = sum * mult;
    this.score += total;
    this.emit('bank', { total, mult, names: this.combo.map((t) => t.name) });
    this.combo = [];
  }

  finish() {
    const s = this.level.stars || [0];
    this.stars = s.filter((t) => this.score >= t).length;
    this.setPhase('complete');
    this.emit('complete', { score: this.score, stars: this.stars });
  }

  // -------------------------------------------------------------- bails

  bail(reason) {
    const s = this.sk;
    this.bailReason = reason;
    this.combo = [];
    s.flip = null;
    s.primed = false;
    s.grind = null;
    s.mode = 'bail';
    s.bail = {
      x: s.x,
      y: s.y,
      vx: reason === 'slam' ? -60 : s.vx * 0.55,
      vy: Math.min(s.vy, 0) - 380,
      ang: 0,
      angV: reason === 'slam' ? -9 : 8,
      bx: s.x,
      by: s.y,
      bvx: reason === 'slam' ? -140 : s.vx * 1.15,
      bvy: -260,
      bang: 0,
      bangV: 14,
    };
    this.setPhase('bailed');
    this.emit('bail', { reason });
  }

  updateBail(dt) {
    const b = this.sk.bail;
    const g = PHYS.GRAVITY;
    // body
    b.vy += g * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.ang += b.angV * dt;
    if (b.y >= WORLD.GROUND) {
      b.y = WORLD.GROUND;
      b.vy *= -0.25;
      b.vx *= 0.6;
      b.angV *= 0.4;
      if (Math.abs(b.vy) < 40) b.vy = 0;
    }
    // board
    b.bvy += g * dt;
    b.bx += b.bvx * dt;
    b.by += b.bvy * dt;
    b.bang += b.bangV * dt;
    if (b.by >= WORLD.GROUND) {
      b.by = WORLD.GROUND;
      b.bvy *= -0.35;
      b.bvx *= 0.75;
      b.bangV *= 0.3;
      if (Math.abs(b.bvy) < 40) {
        b.bvy = 0;
        b.bang = Math.round(b.bang / Math.PI) * Math.PI; // settle flat
        b.bangV = 0;
      }
    }
  }
}
