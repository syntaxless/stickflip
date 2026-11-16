import { WORLD, PHYS, SCORE, TRICKS, GRINDS } from './config.js';

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
// Holding the finger down when you reach a rail also locks a grind, and the
// direction dragged while holding picks which one (see GRINDS in config.js).
//
// Swipes in the air do the other tricks (see TRICKS in config.js). A swipe
// anywhere else acts like a tap, so it can never get you stuck.

export const BAIL_MESSAGES = {
  slam: 'SLAMMED THE RAIL. OLLIE EARLIER!',
  clipped: 'CLIPPED THE RAIL. TAP JUST BEFORE IT!',
  flip: 'LANDED MID-TRICK. START IT EARLIER!',
  gap: 'CAME UP SHORT. OLLIE CLOSER TO THE EDGE!',
  stairs: 'LANDED ON THE STAIRS. OLLIE CLOSER TO THE EDGE!',
  rolled: 'ROLLED OFF THE EDGE. OLLIE BEFORE IT!',
};

// Anything this far below the ground line has fallen into a gap.
const PIT_DEPTH = 40;

// Height of a (possibly sloped) surface at x.
export function surfaceY(surf, x) {
  if (surf.y1 === undefined) return surf.y;
  const t = Math.max(0, Math.min(1, (x - surf.x1) / (surf.x2 - surf.x1)));
  return surf.y1 + (surf.y2 - surf.y1) * t;
}

const FLAT = Object.freeze({ x1: -Infinity, x2: Infinity, y: WORLD.GROUND, landable: true });

const slopeOf = (surf) => (surf.y1 === undefined ? 0 : (surf.y2 - surf.y1) / (surf.x2 - surf.x1));

export class Game {
  constructor(level) {
    this.level = level;
    this.surfaces = level.obstacles.flatMap((o) => o.surfaces);
    this.solids = level.obstacles.flatMap((o) => o.solids);
    // The ground is flat at WORLD.GROUND unless an obstacle (a gap, stairs...)
    // replaces part of it with its own segments { x1, x2, y, landable, bail }.
    this.groundSegs = level.obstacles.flatMap((o) => o.ground || []);
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
    this.hold = null; // { dir, used } while the finger (or Space) is held down
    this.sk = {
      x: PHYS.START_X,
      y: this.groundAt(PHYS.START_X).y,
      vx: 0,
      vy: 0,
      mode: 'idle',
      support: null, // landable surface being rolled on (null = ground)
      flip: null, // { t, key, trick } while an air trick is in progress
      primed: false, // ready to lock a grind on contact
      poppedAt: null, // x where the skater last left the ground (null = rolled off)
      grind: null, // { surface, dist }
      bail: null, // ragdoll state after a bail
    };
  }

  setPhase(phase) {
    this.phase = phase;
    this.phaseTime = 0;
  }

  // The ground segment under x: { y, landable, bail }.
  groundAt(x) {
    for (const g of this.groundSegs) if (x >= g.x1 && x < g.x2) return g;
    return FLAT;
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
    s.poppedAt = s.x;
    this.emit('pop');
  }

  // The finger is held down (dir: null | 'left' | 'right' for a held drag),
  // or lifted (on = false). Returns whether the hold locked a grind, so the
  // UI knows not to treat the lift as a tap or swipe.
  setHold(on, dir = null) {
    if (on) {
      if (this.hold) this.hold.dir = dir;
      else this.hold = { dir, used: false };
      return false;
    }
    const used = !!this.hold?.used;
    this.hold = null;
    return used;
  }

  // Which grind a contact right now would lock.
  grindKey() {
    const d = this.hold?.dir;
    return d === 'right' ? 'nose' : d === 'left' ? '5-0' : '50-50';
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

  // Where (and how soon) the skater will next touch something on the current
  // arc: a surface (flat or sloped, including rails you could pass) or the
  // ground. Stepped forward in time, so any shape of ground works.
  predictContact() {
    const s = this.sk;
    const g = PHYS.GRAVITY;
    const dt = 1 / 240;
    let px = s.x;
    let py = s.y;
    for (let t = dt; t < 2; t += dt) {
      const x = s.x + s.vx * t;
      const y = s.y + s.vy * t + 0.5 * g * t * t;
      for (const surf of this.surfaces) {
        if (x < surf.x1 || x > surf.x2) continue;
        if (py <= surfaceY(surf, px) + 0.01 && y >= surfaceY(surf, x)) return { t, surface: surf };
      }
      if (y >= this.groundAt(x).y || y > WORLD.GROUND + PIT_DEPTH) return { t, surface: null };
      px = x;
      py = y;
    }
    return { t: 2, surface: null };
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
    if (!c.surface || !c.surface.grindable) return null;
    if (this.hold) return 'primed'; // holding: it'll lock on contact
    if (c.t <= PHYS.GRIND_WINDOW) return 'ready';
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
        s.poppedAt = null;
      } else if (!s.support) {
        // follow the ground; a drop (gap, top of the stairs) means falling
        const gy = this.groundAt(s.x).y;
        if (gy > s.y + 1) {
          s.mode = 'air';
          s.vy = 0;
          s.poppedAt = null;
        } else s.y = gy;
      }
      if (this.hitSolid()) return this.bail('slam');
      if (s.x > PHYS.EXIT_X) return this.finish();
    } else if (s.mode === 'grind') {
      const surf = s.grind.surface;
      const step = PHYS.GRIND_SPEED * dt;
      const slope = slopeOf(surf);
      s.x += step;
      s.y = surfaceY(surf, s.x);
      s.grind.dist += step * Math.sqrt(1 + slope * slope);
      if (s.x > surf.x2) {
        this.endGrind();
        s.mode = 'air';
        s.vy = slope * PHYS.GRIND_SPEED; // carry on down a sloped rail
        s.poppedAt = s.x;
      }
    } else if (s.mode === 'air') {
      this.updateAir(dt);
    }
  }

  updateAir(dt) {
    const s = this.sk;
    const prevY = s.y;
    const prevX = s.x;
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
    // Passable surfaces (a handrail beside the stairs) only matter if primed.
    for (const surf of this.surfaces) {
      if (s.x < surf.x1 || s.x > surf.x2) continue;
      const locked = s.primed || (this.hold && !s.flip);
      if (surf.passable && !locked) continue;
      if (prevY <= surfaceY(surf, prevX) + 0.01 && s.y >= surfaceY(surf, s.x)) {
        s.y = surfaceY(surf, s.x);
        if (surf.grindable && locked) {
          if (this.hold) this.hold.used = true;
          return this.startGrind(surf, this.grindKey());
        }
        if (s.flip) return this.bail('flip');
        if (surf.landable) return this.land(surf);
        return this.bail('clipped');
      }
    }

    const ground = this.groundAt(s.x);
    if (s.y >= ground.y) {
      // Came down on it from above, or hit its side (the far wall of a gap)?
      const fromAbove = prevY <= ground.y + 0.01;
      s.y = ground.y;
      if (!fromAbove) return this.bail('gap');
      if (!ground.landable) return this.bail(s.poppedAt === null ? 'rolled' : ground.bail || 'clipped');
      if (s.flip) return this.bail('flip');
      return this.land(null);
    }
    if (s.y > WORLD.GROUND + PIT_DEPTH) return this.bail(s.poppedAt === null ? 'rolled' : 'gap');

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

  startGrind(surface, key = '50-50') {
    const s = this.sk;
    s.mode = 'grind';
    s.vy = 0;
    s.y = surfaceY(surface, s.x);
    s.primed = false;
    s.grind = { surface, dist: 0, key, type: GRINDS[key] };
    this.emit('grind', { key });
  }

  endGrind() {
    const s = this.sk;
    const { dist, type } = s.grind;
    s.grind = null;
    this.addTrick(type.name, type.base + Math.round(dist * SCORE.GRIND_PER_PX));
  }

  land(surface) {
    const s = this.sk;
    s.mode = 'roll';
    s.vy = 0;
    s.support = surface;
    s.y = surface ? surfaceY(surface, s.x) : this.groundAt(s.x).y;
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
    const floor = this.groundAt(b.x).y;
    if (b.y >= floor) {
      b.y = floor;
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
    const bfloor = this.groundAt(b.bx).y;
    if (b.by >= bfloor) {
      b.by = bfloor;
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
