import { GAPS } from './gaps.js';
import { createRagdoll, stepRagdoll } from './ragdoll.js';
import { WORLD, PHYS, SCORE, SPECIAL_POINTS, TRICKS, GRINDS, MANUALS } from './config.js';

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
// Landing from an ollie while still holding a drag back (manual) or forward
// (nose manual) lands into a manual, which keeps the combo running; lifting
// pops an ollie out of it. Holding and dragging down on the ground brakes.
//
// Swipes in the air do the other tricks (see TRICKS in config.js). A swipe
// anywhere else acts like a tap, so it can never get you stuck.

// Bails keep their reason (game.bailReason) but show no tip: players find the
// controls and timing themselves.

// Anything this far below the ground line has fallen into a gap.
const PIT_DEPTH = 40;

// Height of a (possibly sloped or curved) surface at x.
function surfaceY(surf, x) {
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
  //
  // A stage (see stages/compose.js) is a long level with named sections. A
  // bail replays from the start of the section it happened in (keeping the
  // score banked before it); `checkpoint` ({ index, score }) starts there.
  constructor(level, entry = null, checkpoint = null) {
    this.level = level;
    this.entry = entry;
    this.sections = level.sections || [{ name: level.name, x: 0 }];
    this.checkpoint = checkpoint || { index: 0, score: 0 };
    this.finishLeft = level.finishLeft ?? -40;
    this.gaps = GAPS.filter((g) => g.stage === level.id);
    this.surfaces = level.obstacles.flatMap((o) => o.surfaces);
    this.solids = level.obstacles.flatMap((o) => o.solids);
    // The ground is flat at WORLD.GROUND unless an obstacle (a gap, stairs...)
    // replaces part of it with its own segments { x1, x2, y, landable, bail }.
    // Segments can be sloped ({ y1, y2 }: banks) or curved ({ qp }: a quarter pipe).
    this.groundSegs = level.obstacles.flatMap((o) => o.ground || []);
    // Things to pass through, like a ring of fire: { x, top, bottom, reason, trick, points }.
    this.hazards = level.obstacles.flatMap((o) => o.hazards || []);
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
    this.wait = 0; // seconds the rider still stands ready after a restart tap, before rolling off
    const cp = this.checkpoint;
    this.section = cp.index;
    this.score = cp.score;
    this.combo = []; // tricks done since leaving the ground: { name, points, base, exempt }
    this.recent = []; // names of the last SCORE.RUN_WINDOW banked tricks of the run (for the repeat decay)
    this.gapsDone = new Set(); // named gaps earned this attempt
    this.boomAt = null; // when the cop car blew up (game time), or null
    this.events = []; // for the renderer: popups, sparks, sounds
    this.bailReason = null;
    this.hold = null; // { dir, used, dirT } while the finger (or Space) is held down
    this.tilt = 0; // a seesaw plank under a grind: 0 level .. 1 tipped down to the ground
    this.setSeesaw(0);
    const sec = this.sections[cp.index];
    const startX = sec.x + (sec.start ?? PHYS.START_X);
    this.sk = {
      x: startX,
      y: this.groundAt(startX).y,
      vx: 0,
      vy: 0,
      dir: 1, // 1 = riding right, -1 = riding back to the left (after a quarter pipe)
      face: 1, // the way the skater faces: still right when riding back out fakie
      slope: this.groundAt(startX).slope || 0, // of the ground being rolled on
      ramp: null, // { qp, th, dir } while riding a quarter pipe (th: 0 = bottom, PI/2 = vertical)
      qpAir: null, // { qp, t, dur, v } while in the air above a quarter pipe
      manual: null, // { key, type, dist, t } while manualling
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

  get sectionName() {
    return this.sections[this.section].name;
  }

  // Back to the very start of the stage (from the bail screen).
  restartStage() {
    this.checkpoint = { index: 0, score: 0 };
    this.reset();
    this.start(true);
  }

  // Riding into the next section makes it the checkpoint.
  checkSection() {
    const next = this.sections[this.section + 1];
    if (!next || this.sk.dir < 0 || this.sk.x < next.x) return;
    this.section += 1;
    this.checkpoint = { index: this.section, score: this.score };
    this.emit('checkpoint', { index: this.section, name: next.name, score: this.score });
  }

  clampSpeed(v) {
    return Math.max(this.cruise * PHYS.SPEED_MIN, Math.min(this.cruise * PHYS.SPEED_MAX, v));
  }

  // Holding and dragging down brakes, holding otherwise pushes a little. Otherwise the speed drifts back to cruising.
  updateSpeed(dt) {
    const s = this.sk;
    if (s.manual) {
      // a manual keeps speeding up the longer it lasts (see updateManual)
    } else if (s.charge && this.hold?.dir === 'down' && this.hold.dirT >= PHYS.BRAKE_DELAY) {
      this.speed = this.clampSpeed(this.speed - PHYS.BRAKE * dt);
    } else if (s.charge) {
      this.speed = this.clampSpeed(this.speed + PHYS.HOLD_ACCEL * dt); // the crouched push
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
          this.start(true);
        }
        break;
      // 'complete' taps are handled by the UI buttons.
    }
  }

  // `retry`: a restart after a bail. The rider stands ready for RESTART_DELAY
  // first, so the player can lift the finger that restarted and tap again, or
  // keep it down to crouch, before anything is in reach.
  start(retry = false) {
    this.setPhase('playing');
    if (retry && PHYS.RESTART_DELAY > 0) {
      this.wait = PHYS.RESTART_DELAY;
      return;
    }
    this.go();
  }

  // The rider rolls off. A finger still down becomes the crouch (charge).
  go() {
    this.wait = 0;
    this.sk.mode = 'roll';
    this.sk.vx = this.speed;
    this.emit('push');
    if (this.hold) this.startCharge();
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
      if (!this.hold) this.hold = { dir, used: false, dirT: 0 };
      else if (this.hold.dir !== dir) {
        this.hold.dir = dir;
        this.hold.dirT = 0;
      }
      return false;
    }
    let used = !!this.hold?.used;
    this.hold = null;
    // Lifting in a manual pops an ollie out of it, the combo still running.
    if (this.sk.manual) {
      this.endManual();
      if (this.phase === 'playing') {
        this.ollie(1);
        used = true;
      }
    }
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
    const t = Math.max(0, Math.min(head, trick.dur * PHYS.DRAW_CREDIT));
    // t0: the head start from drawing. It shortens the trick, but the
    // animation still plays from the start (see flipProgress).
    this.sk.flip = { t, t0: t, key, trick };
    this.emit('flip', { key });
  }

  // 0..1: how far through the air trick's animation (the drawing head start
  // speeds the animation up instead of skipping its first part).
  flipProgress() {
    const f = this.sk.flip;
    if (!f) return 0;
    const span = f.trick.dur - (f.t0 || 0);
    return span > 0 ? Math.max(0, Math.min(1, (f.t - (f.t0 || 0)) / span)) : 1;
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

  // Tip every seesaw plank (a surface with `seesaw: { drop }`) about its middle:
  // the far end goes down `drop` and the near end up by the same, so a plank
  // standing `drop` high ends with its exit on the ground.
  setSeesaw(tilt) {
    for (const surf of this.surfaces) {
      if (!surf.seesaw) continue;
      surf.y1 = surf.y - tilt * surf.seesaw.drop;
      surf.y2 = surf.y + tilt * surf.seesaw.drop;
    }
  }

  updateSeesaw(dt) {
    const grinding = this.sk.mode === 'grind' && this.sk.grind?.surface.seesaw;
    const to = grinding ? 1 : 0;
    if (this.tilt === to) return;
    const step = dt / (grinding ? 0.7 : 0.4);
    this.tilt = this.tilt < to ? Math.min(to, this.tilt + step) : Math.max(to, this.tilt - step);
    this.setSeesaw(this.tilt);
  }

  // ------------------------------------------------------------- update

  update(dt) {
    this.time += dt;
    this.phaseTime += dt;
    if (this.hold) this.hold.dirT += dt;
    this.updateSeesaw(dt);
    const s = this.sk;
    const fromX = s.x;

    if (this.phase === 'ready') return;
    if (this.phase === 'bailed') return this.updateBail(dt);
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 1e-9) this.go();
      return;
    }
    if (this.phase === 'complete') {
      if (!this.level.sections) {
        // A level that ends on its quarter pipe: the rider coasts to a stop at the foot
        // of it, so he never rolls off the drawn level while the score comes up.
        if (this.level.endAfterQuarter) s.vx *= Math.exp(-3.5 * dt);
        s.x += s.vx * dt; // roll on off-screen (a stage just stops: the camera follows)
      }
      return;
    }

    if (s.manual && s.mode !== 'roll') this.endManual(); // rolled off an edge
    if (s.mode === 'roll') {
      if (s.manual) this.updateManual(dt);
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
      const hit = this.hitSolid();
      if (hit) {
        // A slappy: ride straight into a low curb with the finger held and
        // the trucks slap up onto it, grinding with no ollie at all.
        if (!hit.slappy || !this.hold) return this.bail('slam');
        this.hold.used = true;
        s.charge = null;
        s.x = Math.max(hit.slappy.x1, Math.min(hit.slappy.x2, s.x + s.dir * PHYS.NOSE));
        this.startGrind(hit.slappy, this.grindKey());
        s.grind.slappy = true;
        return;
      }
      if (s.x > this.width + 40 || s.x < (s.dir < 0 ? this.finishLeft : -40)) return this.finish();
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
    if (this.phase === 'playing') this.passHazards(fromX);
    if (this.phase === 'playing') this.checkSection();
  }

  // A ring of fire. Head above its top: you hit the flames. Head inside its
  // opening (a charged ollie): clean through, a trick with a bonus. Head still
  // below the opening (any smaller ollie, even none): you pass under it and
  // nothing happens.
  passHazards(fromX) {
    const s = this.sk;
    if (s.dir < 0) return;
    for (const h of this.hazards) {
      if (fromX >= h.x || s.x < h.x) continue;
      const head = s.y - PHYS.RIDER_HEIGHT;
      if (head < h.top) return this.bail(h.reason);
      if (head < h.bottom) this.addTrick(h.trick, h.points);
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
      if (s.y > r.y + 6 && s.y <= r.y + r.h + 1 && (inX(s.x) || inX(s.x + s.dir * PHYS.NOSE))) return r;
    }
    return null;
  }

  // ------------------------------------------------------------ tricks

  // `kind` 'gap' is a named gap bonus. Gaps and any trick worth SPECIAL_POINTS
  // or more are "specials": the renderer banners them and the audio plays a jingle.
  //
  // Repeats are worth less (SCORE.REPEAT_*): the same trick again in this combo,
  // or already in the recent tricks of the run. Specials and gaps are exempt.
  addTrick(name, points, kind = 'trick') {
    const exempt = kind === 'gap' || points >= SPECIAL_POINTS;
    let value = points;
    if (!exempt) {
      const inCombo = this.combo.filter((t) => t.name === name && !t.exempt).length;
      const inRun = this.recent.filter((n) => n === name).length;
      const f = Math.max(SCORE.REPEAT_MIN, SCORE.REPEAT_COMBO ** inCombo * SCORE.REPEAT_RUN ** inRun);
      value = Math.round(points * f);
    }
    this.combo.push({ name, points: value, base: points, exempt });
    this.emit('trick', { name, points: value, base: points });
    if (exempt) this.emit('special', { name, points, kind });
  }

  // A named gap (src/gaps.js): this take-off and this landing, once per attempt.
  checkGaps(kind) {
    const s = this.sk;
    for (const g of this.gaps) {
      if (this.gapsDone.has(g.id) || (g.on !== 'any' && g.on !== kind)) continue;
      const ox = this.sections[g.section]?.x ?? 0;
      if (s.x < ox + g.to[0] || s.x > ox + g.to[1]) continue;
      if (g.from && (s.poppedAt === null || s.poppedAt < ox + g.from[0] || s.poppedAt > ox + g.from[1])) continue;
      this.gapsDone.add(g.id);
      this.addTrick(g.name, g.points, 'gap');
      this.emit('gap', { name: g.name, points: g.points });
    }
  }

  startGrind(surface, key = '50-50') {
    const s = this.sk;
    s.mode = 'grind';
    s.vy = 0;
    s.y = surfaceY(surface, s.x);
    s.primed = false;
    s.grind = { surface, dist: 0, key, type: GRINDS[key] };
    this.emit('grind', { key });
    this.checkGaps('grind');
  }

  endGrind() {
    const s = this.sk;
    const { dist, type, slappy, surface } = s.grind;
    s.grind = null;
    // a surface that blows up (the cop car's light bar) goes off once the grind is over
    if (surface.explodes && this.boomAt === null) {
      this.boomAt = this.time;
      this.emit('boom');
    }
    this.addTrick(slappy ? `SLAPPY ${type.name}` : type.name, type.base + Math.round(dist * SCORE.GRIND_PER_PX));
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
    this.checkGaps('land');
    if (this.manualKey()) return this.startManual(this.manualKey());
    this.bankCombo();
  }

  // Which manual a landing right now rolls into (null = none): from an ollie,
  // still holding a drag back (manual) or forward (nose manual).
  manualKey() {
    const h = this.hold;
    const s = this.sk;
    if (!h || (h.dir !== 'left' && h.dir !== 'right') || h.dirT < PHYS.MANUAL_DELAY) return null;
    if (s.poppedAt === null || s.dir < 0) return null;
    return (h.dir === 'right') === (s.dir > 0) ? 'nose' : 'manual';
  }

  startManual(key) {
    const s = this.sk;
    s.charge = null;
    s.manual = { key, type: MANUALS[key], dist: 0, pts: 0, t: 0 };
    this.emit('manual', { key });
  }

  updateManual(dt) {
    const s = this.sk;
    const m = s.manual;
    m.t += dt;
    this.speed = Math.min(this.cruise * PHYS.MANUAL_SPEED_MAX, this.speed + this.cruise * PHYS.MANUAL_ACCEL * dt);
    s.vx = s.dir * this.speed;
    m.dist += this.speed * dt;
    // The faster it gets the more each pixel pays (the risk is the reward).
    m.pts += this.speed * dt * m.type.perPx * (this.speed / this.cruise);
    const d = this.hold?.dir;
    if (d === 'left' || d === 'right') m.key = this.manualKeyFor(d);
    m.type = MANUALS[m.key];
    // Drop the board after MANUAL_MAX: the combo banks, the chain ends.
    if (m.t >= PHYS.MANUAL_MAX) {
      this.endManual();
      this.bankCombo();
      if (this.hold) this.hold.dir = null;
    }
  }

  manualKeyFor(d) {
    return (d === 'right') === (this.sk.dir > 0) ? 'nose' : 'manual';
  }

  // Add the manual to the combo (it banks when the chain ends on a plain landing).
  endManual() {
    const s = this.sk;
    const m = s.manual;
    s.manual = null;
    if (m) this.speed = this.cruise; // the speed resets when the manual ends
    if (!m || m.dist < 20) return;
    this.addTrick(m.type.name, m.type.base + Math.round(m.pts));
  }

  bankCombo() {
    if (!this.combo.length) return;
    this.recent = [...this.recent, ...this.combo.filter((t) => !t.exempt).map((t) => t.name)].slice(-SCORE.RUN_WINDOW);
    const sum = this.combo.reduce((a, t) => a + t.points, 0);
    const mult = this.combo.length;
    const total = sum * mult;
    this.score += total;
    this.emit('bank', { total, mult, names: this.combo.map((t) => t.name) });
    this.combo = [];
  }

  finish() {
    if (this.sk.manual) {
      this.endManual();
      this.bankCombo();
    }
    this.setPhase('complete');
    this.emit('complete', { score: this.score });
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
    s.manual = null;
    s.mode = 'bail';
    const slam = reason === 'slam' || reason === 'wall';
    const vx = slam ? -s.dir * 110 : s.vx * 0.7;
    const vy = Math.min(s.vy, 0) - 640;
    s.bail = {
      x: s.x,
      y: s.y,
      vx,
      vy,
      rag: createRagdoll(s.x, s.y, s.dir || 1, vx, vy, (slam ? -16 : 14) * s.dir),
      bx: s.x,
      by: s.y,
      bvx: slam ? -s.dir * 170 : s.vx * 1.15,
      bvy: -460,
      bang: 0,
      bangV: 20 * s.dir,
    };
    this.syncBail();
    this.setPhase('bailed');
    this.emit('bail', { reason });
  }

  // The body is the ragdoll; b.x/b.y (hip, lowered to the old body height) is what the camera follows.
  syncBail() {
    const b = this.sk.bail;
    const hip = b.rag.pts.hip;
    b.x = hip.x;
    b.y = hip.y + 12;
  }

  updateBail(dt) {
    const b = this.sk.bail;
    const g = PHYS.GRAVITY;
    stepRagdoll(b.rag, dt, (x) => this.groundAt(x).y);
    this.syncBail();
    // the board tumbles on its own: it bounces higher and keeps spinning until it settles flat
    b.bvy += g * dt;
    b.bx += b.bvx * dt;
    b.by += b.bvy * dt;
    b.bang += b.bangV * dt;
    const bfloor = this.groundAt(b.bx).y;
    if (b.by >= bfloor) {
      b.by = bfloor;
      b.bvy *= -0.5;
      b.bvx *= 0.82;
      b.bangV *= 0.7;
      if (Math.abs(b.bvy) < 50) {
        b.bvy = 0;
        if (Math.abs(b.bangV) < 3) {
          b.bang = Math.round(b.bang / Math.PI) * Math.PI; // settle flat
          b.bangV = 0;
          b.bvx *= 0.9;
        }
      }
    }
  }
}
