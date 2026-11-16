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
  step: 'LANDED ON THE STEP. OLLIE OFF THE LIP!',
  stairsUp: 'HIT THE STAIRS. OLLIE UP THEM OFF THE BANK!',
  wall: 'HIT THE WALL. STAY IN THE RAMP!',
};

// Anything this far below the ground line has fallen into a gap.
const PIT_DEPTH = 40;

// Height of a (possibly sloped or curved) surface at x.
export function surfaceY(surf, x) {
  if (surf.qp) {
    const { cx, cy, R } = surf.qp;
    const d = Math.max(0, Math.min(R, x - cx));
    return cy + Math.sqrt(R * R - d * d);
  }
  const t = Math.max(0, Math.min(1, (x - surf.x1) / (surf.x2 - surf.x1)));
  if (surf.arc) return surf.y - surf.arc * 4 * t * (1 - t); // a rainbow rail: ends at y, middle arc higher
  if (surf.y1 === undefined) return surf.y;
  return surf.y1 + (surf.y2 - surf.y1) * t;
}

const FLAT = Object.freeze({ x1: -Infinity, x2: Infinity, y: WORLD.GROUND, landable: true });

export const slopeOf = (surf, x) => {
  if (surf.arc) {
    const t = Math.max(0, Math.min(1, (x - surf.x1) / (surf.x2 - surf.x1)));
    return (-surf.arc * 4 * (1 - 2 * t)) / (surf.x2 - surf.x1);
  }
  if (surf.qp) {
    const { cx, R } = surf.qp;
    const d = Math.max(0, Math.min(R - 0.5, x - cx));
    return -d / Math.sqrt(R * R - d * d);
  }
  return surf.y1 === undefined ? 0 : (surf.y2 - surf.y1) / (surf.x2 - surf.x1);
};

export class Game {
  // `entry` ({ speed }) rolls the rider straight in from the left edge, still
  // moving: the next screen of a continuous run. Without it the rider waits at
  // the start for a tap.
  constructor(level, entry = null) {
    this.level = level;
    this.entry = entry;
    this.surfaces = level.obstacles.flatMap((o) => o.surfaces);
    this.solids = level.obstacles.flatMap((o) => o.solids);
    // The ground is flat at WORLD.GROUND unless an obstacle (a gap, stairs...)
    // replaces part of it with its own segments { x1, x2, y, landable, bail }.
    // Segments can be sloped ({ y1, y2 }: banks) or curved ({ qp }: a quarter pipe).
    this.groundSegs = level.obstacles.flatMap((o) => o.ground || []);
    this.baseSpeed = level.speed || PHYS.ROLL_SPEED;
    this.width = level.width || WORLD.W; // wider levels scroll
    this.reset();
  }

  reset() {
    this.cruise = this.baseSpeed; // the speed the rider drifts back to (a quarter pipe raises it, see enterRamp)
    this.speed = this.baseSpeed; // riding speed right now (holding speeds up, dragging back brakes)
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
      dir: 1, // 1 = riding right, -1 = riding back to the left (after a quarter pipe)
      face: 1, // the way the skater faces: still right when riding back out fakie
      slope: this.groundAt(PHYS.START_X).slope || 0, // of the ground being rolled on
      ramp: null, // { qp, th, dir } while riding a quarter pipe (th: 0 = bottom, PI/2 = vertical)
      qpAir: null, // { qp, t, dur, v } while in the air above a quarter pipe
      charge: null, // { t } while holding down on the ground to charge an ollie
      mode: 'idle',
      support: null, // landable surface being rolled on (null = ground)
      flip: null, // { t, key, trick } while an air trick is in progress
      primed: false, // ready to lock a grind on contact
      poppedAt: null, // x where the skater last left the ground (null = rolled off)
      grind: null, // { surface, dist }
      bail: null, // ragdoll state after a bail
    };
    const entry = this.entry;
    this.entry = null; // a retry after a bail starts from a standstill
    if (entry) {
      const s = this.sk;
      s.x = PHYS.ENTRY_X;
      s.y = this.groundAt(s.x).y;
      this.speed = this.clampSpeed(entry.speed || this.baseSpeed);
      this.start();
    }
  }

  clampSpeed(v) {
    return Math.max(this.cruise * PHYS.SPEED_MIN, Math.min(this.cruise * PHYS.SPEED_MAX, v));
  }

  // Holding speeds up (crouched push), dragging forward speeds up more,
  // dragging back brakes. Not holding drifts back to cruising speed.
  updateSpeed(dt) {
    const s = this.sk;
    if (s.charge) {
      const d = this.hold?.dir;
      const fwd = d && (d === 'right') === (s.dir > 0);
      const accel = !d ? PHYS.HOLD_ACCEL : fwd ? PHYS.PUSH_ACCEL : -PHYS.BRAKE;
      this.speed = this.clampSpeed(this.speed + accel * dt);
    } else {
      const diff = this.cruise - this.speed;
      this.speed += Math.sign(diff) * Math.min(Math.abs(diff), PHYS.SPEED_RETURN * dt);
    }
    s.vx = s.dir * this.speed;
  }

  // 0 at cruising speed, up to 1 at top speed, down to -1 at the slowest.
  speedLevel() {
    const r = this.speed / this.cruise;
    return r >= 1 ? (r - 1) / (PHYS.SPEED_MAX - 1) : -(1 - r) / (1 - PHYS.SPEED_MIN);
  }

  setPhase(phase) {
    this.phase = phase;
    this.phaseTime = 0;
  }

  // The ground under x: { y, slope, landable, bail, wall }.
  groundAt(x) {
    for (const g of this.groundSegs) {
      if (x >= g.x1 && x < g.x2) return g.y1 === undefined && !g.qp && !g.arc ? g : { ...g, y: surfaceY(g, x), slope: slopeOf(g, x) };
    }
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
    this.sk.vx = this.speed;
    this.emit('push');
  }

  skaterTap() {
    const s = this.sk;
    if (s.mode === 'roll') {
      this.ollie(1);
    } else if (s.mode === 'grind') {
      this.endGrind();
      this.takeOff(PHYS.POP_V);
    } else if (s.mode === 'air') {
      this.airTap();
    }
  }

  // An ollie from the ground; `power` 1 is a normal one. Rolling up a bank adds to the pop.
  ollie(power) {
    const s = this.sk;
    s.charge = null;
    // Faster pops a little higher, slower a little lower, but never past a full charge's cap.
    const v = this.speedLevel();
    const bySpeed = 1 + (v > 0 ? v * PHYS.SPEED_POP_UP : v * PHYS.SPEED_POP_DOWN);
    power = Math.min(1 + PHYS.CHARGE_BOOST, power * bySpeed);
    this.takeOff((PHYS.OLLIE_V + Math.max(0, -s.slope * s.vx)) * power);
  }

  // Charged ollie: hold down on the ground to crouch, let go to pop. A quick
  // tap is a normal ollie; holding longer pops higher, up to a cap.
  startCharge() {
    const s = this.sk;
    if (this.phase !== 'playing' || s.mode !== 'roll' || s.charge) return false;
    s.charge = { t: 0 };
    return true;
  }

  // 0..1: how charged the ollie is (for the crouch).
  chargeLevel() {
    const c = this.sk.charge;
    if (!c) return 0;
    return Math.max(0, Math.min(1, (c.t - PHYS.CHARGE_MIN) / PHYS.CHARGE_TIME));
  }

  // Let go: ollie if still rolling. Returns whether it popped.
  releaseCharge() {
    const s = this.sk;
    if (!s.charge) return false;
    const k = this.chargeLevel();
    s.charge = null;
    if (this.phase !== 'playing' || s.mode !== 'roll') return false;
    this.ollie(1 + k * PHYS.CHARGE_BOOST);
    return true;
  }

  cancelCharge() {
    this.sk.charge = null;
  }

  takeOff(speed) {
    const s = this.sk;
    s.mode = 'air';
    s.vy = -speed;
    s.vx = s.dir * this.speed;
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
    if (!d) return '50-50';
    return (d === 'right') === (this.sk.dir > 0) ? 'nose' : '5-0'; // forward = the way you're riding
  }

  // A swipe, read by gesture.js: a TRICKS key. Anywhere but the air a swipe
  // is a tap. `drawn` is how long the finger took to draw it (seconds): the
  // trick counts as already that far along (up to 60% of it), so the time
  // spent drawing a shape doesn't eat into the air time it needs.
  swipe(key, drawn = 0) {
    if (this.phase !== 'playing' || this.sk.mode !== 'air') return this.tap();
    if (!TRICKS[key]) return;
    const s = this.sk;
    if (s.flip || s.primed) return; // one thing at a time: input during a trick is ignored
    this.startTrick(key, drawn);
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

  startTrick(key, head = 0) {
    const trick = TRICKS[key];
    this.sk.flip = { t: Math.max(0, Math.min(head, trick.dur * PHYS.DRAW_CREDIT)), key, trick };
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
      if (s.charge) s.charge.t += dt;
      this.updateSpeed(dt);
      s.x += s.vx * dt;
      if (s.support && (s.x > s.support.x2 || s.x < s.support.x1)) {
        s.mode = 'air';
        s.vy = 0;
        s.support = null;
        s.poppedAt = null;
      } else if (!s.support) {
        // Follow the ground (banks included). A drop (gap, top of the stairs,
        // the lip of a bank) means flying off it; a step up means a slam.
        const ground = this.groundAt(s.x);
        if (ground.qp && s.dir > 0) return this.enterRamp(ground.qp);
        const give = Math.abs((ground.slope || 0) * s.vx * dt) + 1;
        if (ground.y > s.y + give) {
          s.mode = 'air';
          s.vy = s.slope * s.vx; // a bank's lip throws you up
          s.poppedAt = null;
        } else if (ground.y < s.y - give - 5) {
          return this.bail(ground.wall || 'wall');
        } else {
          s.y = ground.y;
          s.slope = ground.slope || 0;
        }
      }
      if (this.hitSolid()) return this.bail('slam');
      if (s.x > this.width + 40 || s.x < -40) return this.finish();
    } else if (s.mode === 'ramp') {
      this.updateRamp(dt);
    } else if (s.mode === 'grind') {
      const surf = s.grind.surface;
      const grindSpeed = this.speed * (PHYS.GRIND_SPEED / PHYS.ROLL_SPEED);
      const step = grindSpeed * dt;
      const slope = slopeOf(surf, s.x);
      s.x += s.dir * step;
      s.y = surfaceY(surf, s.x);
      s.grind.dist += step * Math.sqrt(1 + slope * slope);
      if (s.dir > 0 ? s.x > surf.x2 : s.x < surf.x1) {
        this.endGrind();
        s.mode = 'air';
        s.vy = slope * s.dir * grindSpeed; // carry on down a sloped rail
        s.poppedAt = s.x;
      }
    } else if (s.mode === 'air') {
      this.updateAir(dt);
    }
  }

  // Quarter pipe. Arcade rules: ride up the curve at riding pace, carry
  // straight on up out of it at that same speed, then come straight back down
  // at it (QP_AIR_TIME in all), with no turning in the air: lots of hang time
  // for tricks. Then ride back down and out to the left, fakie.
  enterRamp(qp) {
    const s = this.sk;
    // A quarter pipe speeds the rider up (QP_SPEED): faster up the curve and
    // a faster ride out afterwards. (The air has its own QP_AIR_SPEED.)
    this.cruise = this.baseSpeed * PHYS.QP_SPEED;
    this.speed = this.cruise;
    s.mode = 'ramp';
    s.slope = 0;
    const th = Math.asin(Math.max(0, Math.min(1, (s.x - qp.cx) / qp.R)));
    s.ramp = { qp, th, dir: 1 };
  }

  updateRamp(dt) {
    const s = this.sk;
    const r = s.ramp;
    const { cx, cy, R } = r.qp;
    // Keep the riding pace across the screen: the steeper the curve, the
    // faster along it, so going up doesn't read as slowing down (capped near
    // the top, where the curve turns vertical).
    const pace = Math.min(PHYS.QP_RAMP_BOOST, 1 / Math.cos(r.th));
    r.th += (r.dir * this.speed * pace * dt) / R;
    if (r.dir > 0 && r.th >= Math.PI / 2) {
      // out over the coping, straight up
      s.ramp = null;
      s.mode = 'air';
      // the air's speed is its own (QP_AIR_SPEED), so its height stays put
      s.qpAir = { qp: r.qp, t: 0, dur: PHYS.QP_AIR_TIME, v: this.baseSpeed * PHYS.QP_AIR_SPEED };
      s.x = cx + R - 1;
      s.y = cy;
      s.vx = 0;
      s.vy = -s.qpAir.v;
      s.poppedAt = s.x;
      this.emit('pop');
    } else if (r.dir < 0 && r.th <= 0) {
      s.ramp = null;
      s.mode = 'roll';
      s.x = cx;
      s.y = cy + R;
      s.vx = -this.speed;
      s.slope = 0;
      if (this.level.endAfterQuarter) this.finish(); // the quarter pipe is the finale
    } else {
      s.x = cx + R * Math.sin(r.th);
      s.y = cy + R * Math.cos(r.th);
    }
  }

  stepTrick(dt) {
    const s = this.sk;
    if (!s.flip) return;
    s.flip.t += dt;
    const { trick } = s.flip;
    if (s.flip.t >= trick.dur) {
      s.flip = null;
      this.addTrick(trick.name, trick.points);
    }
  }

  updateAir(dt) {
    const s = this.sk;
    const prevY = s.y;
    const prevX = s.x;
    if (s.qpAir) s.vy = s.qpAir.t < s.qpAir.dur / 2 ? -s.qpAir.v : s.qpAir.v; // steady up, steady down
    else s.vy += PHYS.GRAVITY * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    this.stepTrick(dt);

    if (s.qpAir) {
      // Straight up and back down into the quarter pipe, turning around on the way.
      const { qp } = s.qpAir;
      s.qpAir.t += dt;
      if (s.vy > 0 && s.y >= qp.cy) {
        if (s.flip) return this.bail('flip');
        s.qpAir = null;
        s.dir = -1;
        s.y = qp.cy;
        s.mode = 'ramp';
        s.ramp = { qp, th: Math.PI / 2, dir: -1 };
        this.addTrick('FS AIR', 100);
        this.emit('land');
        this.bankCombo();
      }
      return;
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
      const fromAbove = prevY <= ground.y + 0.01 + Math.abs((ground.slope || 0) * (s.x - prevX));
      s.y = ground.y;
      if (!fromAbove) return this.bail(ground.wall || 'gap');
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
      if (s.y > r.y + 6 && s.y <= r.y + r.h + 1 && (inX(s.x) || inX(s.x + s.dir * PHYS.NOSE))) return true;
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
    const ground = this.groundAt(s.x);
    s.y = surface ? surfaceY(surface, s.x) : ground.y;
    s.slope = surface ? 0 : ground.slope || 0;
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
    s.ramp = null;
    s.qpAir = null;
    s.charge = null;
    s.mode = 'bail';
    s.bail = {
      x: s.x,
      y: s.y,
      vx: reason === 'slam' || reason === 'wall' ? -s.dir * 60 : s.vx * 0.55,
      vy: Math.min(s.vy, 0) - 380,
      ang: 0,
      angV: (reason === 'slam' ? -9 : 8) * s.dir,
      bx: s.x,
      by: s.y,
      bvx: reason === 'slam' ? -s.dir * 140 : s.vx * 1.15,
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
