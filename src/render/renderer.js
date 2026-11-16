import { WORLD, PHYS } from '../config.js';
import { slopeOf } from '../game.js';
import { PAL, RES } from './pixel.js';
import { INITIALS } from '../leaderboard.js';
import { PoseBlender, drawFigure, drawBoard, boardPitch, makeTransform } from './stickman.js';

// DOS-style renderer. The game world is 960x540 units; it is drawn into a
// 320x180 framebuffer (1 pixel = 3 units) using 3 colours, then scaled up
// with nearest-neighbour so every pixel stays chunky.

const S = 3;
const P = (v) => Math.round(v / S);
const { sky, ink, red } = PAL;
const pad = (n, len = 6) => String(Math.max(0, n)).padStart(len, '0');

export class Renderer {
  constructor(pix) {
    this.g = pix;
    this.reset();
  }

  // `keepPose`: the rider rolled on from the last screen, so don't snap his pose.
  reset(keepPose = false) {
    if (!keepPose || !this.pose) this.pose = new PoseBlender('idle');
    this.particles = [];
    // Pop-up text lives in one fixed slot under the HUD, and a new message
    // replaces the old one instead of piling on top of it. Trick names show in
    // the HUD's combo line; the slot is for the points, banked on landing,
    // when the rider is down on the ground and out of the way.
    this.popups = { bank: null };
    this.squash = 0;
    this.buttons = [];
    this.time = 0;
  }

  // Turn game events into visual effects.
  consume(events) {
    for (const e of events) {
      switch (e.type) {
        case 'pop':
          this.dust(e.x, e.y, 4);
          break;
        case 'land':
          this.squash = 0.18;
          this.dust(e.x, e.y, 6);
          break;
        case 'grind':
          this.sparks(e.x, e.y, 10);
          break;
        case 'bank':
          this.popup('bank', e.mult > 1 ? `+${e.total} ${e.mult}X COMBO` : `+${e.total}`);
          break;
        case 'bail':
          this.dust(e.x, e.y, 10);
          break;
      }
    }
  }

  dust(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({ kind: 'dust', x: x + (Math.random() - 0.5) * 40, y: y - 3, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 120, life: 0.4 });
    }
  }

  sparks(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({ kind: 'spark', x: x + (Math.random() - 0.5) * 30, y: y - 3, vx: -80 - Math.random() * 260, vy: -60 - Math.random() * 260, life: 0.3 });
    }
  }

  popup(slot, text) {
    this.popups[slot] = { text, life: 1.1 };
  }

  // ----------------------------------------------------------- drawing

  draw(game, dt, opts = {}) {
    const g = this.g;
    this.time += dt;
    this.frameDt = dt;
    this.step(game, dt);

    g.clear(sky);
    // Wide levels scroll: the camera follows the skater (and rises with big airs).
    const cam = this.camera(game);
    g.ox = -cam.x;
    g.oy = -cam.y;
    this.drawBackground(game, cam);
    for (const o of game.level.obstacles) o.draw(g, { time: this.time });
    this.drawSkater(game);
    this.drawParticles();
    g.ox = 0;
    g.oy = 0;
    const inset = Math.ceil(opts.inset || 0);
    this.drawPopups(inset);
    this.drawHud(game, opts, inset);
    this.drawOverlay(game, opts);
    g.flush();
  }

  step(game, dt) {
    this.squash = Math.max(0, this.squash - dt);
    if (game.sk.mode === 'grind' && Math.random() < 0.6) this.sparks(game.sk.x, game.sk.y, 1);
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.kind === 'spark' ? 1400 : 300) * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const k of Object.keys(this.popups)) {
      const p = this.popups[k];
      if (p && (p.life -= dt) <= 0) this.popups[k] = null;
    }
    // Bails and the level-end box use the middle of the screen: clear the way.
    if (game.phase !== 'playing') this.popups = { bank: null };
  }

  // Camera position in pixels. Fixed-screen levels never move it.
  camera(game) {
    if (game.width <= WORLD.W) return { x: 0, y: 0 };
    const s = game.sk;
    const fx = s.mode === 'bail' && s.bail ? s.bail.x : s.x;
    const fy = s.mode === 'bail' && s.bail ? s.bail.y : s.y;
    const x = Math.max(0, Math.min(game.width - WORLD.W, fx - WORLD.W / 3));
    const y = Math.min(0, fy - 330);
    return { x: Math.round(x / S), y: Math.round(y / S) };
  }

  drawBackground(game, cam = { x: 0, y: 0 }) {
    const g = this.g;
    const G = P(WORLD.GROUND);

    // ground: solid black, column by column so gaps, banks, ramps and stairs
    // all come from the level's ground segments
    const bottom = RES.H + cam.y;
    for (let x = cam.x; x < cam.x + RES.W; x++) {
      const top = P(game.groundAt(x * S + S / 2).y);
      if (top < bottom) g.fill(x, top, 1, bottom - top, ink);
    }
  }

  drawSkater(game) {
    const g = this.g;
    const s = game.sk;
    const dt = this.frameDt || 1 / 60;

    if (s.mode === 'bail' && s.bail) {
      const b = s.bail;
      this.pose.update('bail', dt, 10);
      drawBoard(g, makeTransform(b.bx, b.by, b.bang * 0.15), b.bang);
      const onGround = b.y >= game.groundAt(b.x).y - 0.5 && b.vy === 0;
      const ang = onGround ? Math.sign(b.ang || 1) * Math.min(Math.abs(b.ang), Math.PI / 2) : b.ang;
      const hip = this.pose.pose.hip;
      // rotate around the hip, which sits at the bail body position
      const base = makeTransform(b.x, b.y - (onGround ? 12 : 40), ang);
      drawFigure(g, (p) => base({ x: p.x - hip.x, y: p.y - hip.y }), this.pose.pose);
      return;
    }

    let target = 'roll';
    if (game.phase === 'ready') target = 'idle';
    else if (s.mode === 'grind') target = 'grind';
    else if (s.mode === 'air') target = s.flip ? 'flip' : s.primed ? 'prime' : 'air';
    else if (s.mode === 'ramp') target = 'crouch';
    else if (s.charge) target = game.chargeLevel() > 0.5 ? 'charge' : 'crouch'; // crouch deeper the longer you hold
    else if (this.squash > 0) target = 'crouch';
    this.pose.update(target, dt);

    // The board follows the ground (banks), tilts with the arc in the air,
    // and with the rail on a sloped grind. `face` is the way the skater faces:
    // after a quarter pipe they ride back out fakie, still facing right.
    const face = s.face;
    let pitch = s.mode === 'air' ? boardPitch(s.vy) * face : s.mode === 'roll' ? Math.atan(s.slope) : 0;
    if (s.mode === 'grind') {
      const r = s.grind.surface;
      if (r.y1 !== undefined || r.arc) pitch = Math.atan(slopeOf(r, s.x));
      pitch += s.grind.type.pitch * face; // 5-0 tips the nose up, nose grind tips it down
    } else if (s.mode === 'ramp') {
      pitch = -s.ramp.th; // standing on the curve
    } else if (s.qpAir) {
      pitch = -Math.PI / 2; // straight up and down, just as you left the wall
    }
    let base = makeTransform(s.x, s.y, pitch);
    if (s.flip?.trick.body === 'backflip') {
      // Head over heels, backwards (counter-clockwise when riding right),
      // turning around the middle of the body.
      const p = Math.min(1, s.flip.t / s.flip.trick.dur);
      const a = -p * Math.PI * 2 * face;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const mid = -30;
      const tf = base;
      base = (q) => tf({ x: c * q.x - sn * (q.y - mid), y: mid + sn * q.x + c * (q.y - mid) });
    }
    // Side view, so turning around the vertical axis is drawn by squashing x:
    // cos() goes 1 -> 0 (edge-on) -> -1 (facing back) -> 1. Mirrored when facing left.
    const squashX = (tf, sx) => (p) => tf({ x: p.x * sx * face, y: p.y });
    let spin = 0; // board roll around its long axis
    let lift = 0;
    let boardSx = 1;
    let bodySx = 1;
    if (s.flip) {
      const { trick } = s.flip;
      const p = Math.min(1, s.flip.t / trick.dur);
      const turn = (n) => Math.cos(p * Math.PI * n);
      lift = Math.sin(p * Math.PI) * 12;
      if (trick.roll) spin = trick.roll * p * Math.PI * 2;
      if (trick.turn) boardSx = turn(trick.turn);
      if (trick.body === 'backflip') lift = 0;
      if (trick.body === 'spin') {
        bodySx = turn(2);
        boardSx = bodySx;
        lift = 0;
      }
    }
    drawBoard(g, squashX(base, boardSx), spin, lift);
    drawFigure(g, squashX(base, bodySx), this.pose.pose);
  }

  drawParticles() {
    for (const p of this.particles) {
      const c = p.kind === 'spark' ? red : ink;
      this.g.pset(P(p.x), P(p.y), c);
    }
  }

  // Centred under the HUD (which ends about y 33).
  drawPopups(inset = 0) {
    const rows = [['bank', 42]];
    for (const [slot, y] of rows) {
      const p = this.popups[slot];
      if (!p || (p.life < 0.3 && Math.floor(p.life * 20) % 2)) continue; // blink out
      this.g.text(fit(this.g, p.text, RES.W - 2 * inset - 8), RES.W / 2, y, red, 1, 'center');
    }
  }

  // `inset` is how many pixels at each side are cropped off (zoomed portrait view).
  drawHud(game, opts, inset = 0) {
    const g = this.g;
    const L = 4 + inset;
    const R = RES.W - 4 - inset;
    g.text(`${game.levelLabel || `LEVEL ${game.levelNumber || 1}`}: ${game.level.name}`, L, 4, red);
    // Top right: just the running total for the run, with the speed under it.
    // Tricks and combos pop up on screen; high scores wait for the end.
    const total = opts.total ?? game.score;
    g.text(`TOTAL ${pad(total)}`, R, 4, red, 1, 'right');
    if (game.phase === 'playing') this.drawSpeed(game, R, 15);
    if (game.combo.length && game.phase === 'playing') {
      // Under the level name, kept clear of the right-hand column: the oldest
      // tricks drop off the front when the list gets too long.
      const room = R - L - Math.max(g.textWidth(`TOTAL ${pad(total)}`), 75) - 8;
      const names = game.combo.map((t) => t.name);
      let text = names.join(' + ');
      for (let i = 1; i < names.length && g.textWidth(text) > room; i++) text = `...${names.slice(i).join(' + ')}`;
      g.text(fit(g, text, room), L, 15, red);
    }
  }

  // SPEED and a bar of cells, right-aligned to `right`: the middle cell is cruising speed.
  drawSpeed(game, right, y) {
    const g = this.g;
    const cells = 10;
    const lo = game.cruise * PHYS.SPEED_MIN;
    const hi = game.cruise * PHYS.SPEED_MAX;
    const n = Math.round(1 + ((cells - 1) * (game.speed - lo)) / (hi - lo));
    const bx = right - cells * 4 + 1;
    g.text('SPEED', bx - 4, y, red, 1, 'right');
    for (let i = 0; i < cells; i++) {
      if (i < n) g.fill(bx + i * 4, y, 3, 7, red);
      else g.rect(bx + i * 4, y, 3, 7, red);
    }
  }

  // Each new screen (and each retry) names its level (no hints) for a moment, over the
  // sky, without stopping the ride.
  drawTitleCard(game) {
    const g = this.g;
    const t = game.phaseTime;
    if (t > 1.8 || (t > 1.4 && Math.floor(t * 20) % 2)) return; // blink out
    const cx = RES.W / 2;
    const label = game.levelLabel || `LEVEL ${game.levelNumber || 1}`;
    g.text(label, cx, 44, red, 1, 'center');
    g.text(game.level.name, cx + 1, 57, ink, 2, 'center');
    g.text(game.level.name, cx, 56, red, 2, 'center');
  }

  blink(rate = 3) {
    return Math.floor(this.time * rate * 2) % 2 === 0;
  }

  drawOverlay(game, opts = {}) {
    const g = this.g;
    this.buttons = [];
    const cx = RES.W / 2;

    if (opts.screen?.type === 'entry') return this.drawEntry(opts.screen);
    if (opts.screen?.type === 'scores') return this.drawScores(opts.screen, opts.highScores || []);
    if (opts.screen?.type === 'unlock') return this.drawUnlock(opts.screen);

    if (game.phase === 'ready') {
      // Arcade attract mode: on the first level, the title takes turns with the high scores.
      const showTable = opts.attract && opts.highScores?.length && Math.floor(this.time / 4) % 2 === 1;
      // Rows sit clear of the rider's head and of level 3's handrail; in portrait the
      // swipe tip makes way for the "turn sideways" notice under TAP TO START.
      let tapY;
      if (showTable) {
        g.text('HIGH SCORES', cx + 1, 39, ink, 2, 'center');
        g.text('HIGH SCORES', cx, 38, red, 2, 'center');
        this.drawTable(opts.highScores, 62, -1, 11);
        tapY = 124;
      } else {
        g.text('STICKFLIP', cx + 1, 39, ink, 4, 'center');
        g.text('STICKFLIP', cx, 38, red, 4, 'center');
        tapY = 80; // no control tips: players find the controls themselves
      }
      if (this.blink()) g.text('TAP TO START', cx, tapY, red, 1, 'center');
      if (opts.portrait) g.text('TURN DEVICE SIDEWAYS', cx, tapY + 11, red, 1, 'center');
    } else if (game.phase === 'bailed') {
      g.text('BAIL!', cx + 1, 39, ink, 3, 'center');
      g.text('BAIL!', cx, 38, red, 3, 'center');
      g.text('SUCKS TO SUCK', cx, 64, red, 1, 'center');
      if (game.phaseTime >= PHYS.BAIL_RETRY_DELAY && this.blink()) g.text('TAP TO TRY AGAIN', cx, 78, red, 1, 'center');
    } else if (game.phase === 'playing') {
      this.drawTitleCard(game);
    }
  }

  // The secret level's arrival: a blinking banner over the scene.
  drawUnlock(screen) {
    const g = this.g;
    const cx = RES.W / 2;
    const [x, y, w, h] = [20, 48, 280, 70];
    g.fill(x, y, w, h, ink);
    g.rect(x, y, w, h, red);
    g.rect(x + 2, y + 2, w - 4, h - 4, red);
    if (this.blink(4)) {
      g.text('SECRET LEVEL', cx, y + 12, red, 3, 'center');
      g.text(screen.first ? 'UNLOCKED!' : 'AHEAD!', cx, y + 38, red, 2, 'center');
    }
  }

  button(id, label, x, y, w, enabled) {
    const g = this.g;
    const h = 15;
    if (enabled) {
      g.fill(x, y, w, h, red);
      g.text(label, x + w / 2, y + 4, ink, 1, 'center');
      // hit box in world units
      this.buttons.push({ id, x: x * S, y: y * S, w: w * S, h: h * S });
    } else {
      g.rect(x, y, w, h, red);
      g.text(label, x + w / 2, y + 4, red, 1, 'center');
    }
  }

  // A box like the level-complete one, for the end-of-run screens.
  panel(title) {
    const g = this.g;
    const [x, y, w, h] = [56, 38, 208, 136];
    g.fill(x, y, w, h, ink);
    g.rect(x, y, w, h, red);
    g.rect(x + 2, y + 2, w - 4, h - 4, red);
    g.text(title, RES.W / 2, y + 9, red, 2, 'center');
    return { x, y, w, h };
  }

  // Rows like "1. ABC  001234"; the row at `highlight` blinks.
  drawTable(list, y, highlight = -1, rowH = 11) {
    const cx = RES.W / 2;
    list.forEach((e, i) => {
      if (i === highlight && !this.blink(2)) return;
      this.g.text(`${i + 1}. ${e.initials.padEnd(INITIALS)}  ${pad(e.score)}`, cx, y + i * rowH, red, 1, 'center');
    });
  }

  // Initials entry: INITIALS letters, each with + and - buttons, then OK.
  drawEntry(scr) {
    const g = this.g;
    const cx = RES.W / 2;
    const { y } = this.panel('NEW HIGH SCORE!');
    g.text(`RUN TOTAL ${pad(scr.score)}`, cx, y + 30, red, 1, 'center');
    g.text('ENTER YOUR INITIALS', cx, y + 42, red, 1, 'center');
    const left = cx - 72;
    for (let i = 0; i < INITIALS; i++) {
      const lx = left + i * 26;
      this.button(`up${i}`, '+', lx, y + 56, 20, true);
      if (i !== scr.pos || this.blink(2)) g.text(scr.letters[i], lx + 10, y + 76, red, 2, 'center');
      if (i === scr.pos) g.line(lx + 2, y + 92, lx + 17, y + 92, red);
      this.button(`dn${i}`, '-', lx, y + 96, 20, true);
    }
    this.button('ok', 'OK', left + INITIALS * 26 + 8, y + 75, 32, true);
  }

  drawScores(scr, list) {
    const g = this.g;
    const cx = RES.W / 2;
    const { y } = this.panel('HIGH SCORES');
    if (scr.score != null) g.text(`YOUR RUN: ${pad(scr.score)}`, cx, y + 30, red, 1, 'center');
    if (list.length) this.drawTable(list, y + 46, scr.highlight, 12);
    else g.text('NO SCORES YET', cx, y + 60, red, 1, 'center');
    // Beat the game: start over from level 1 with a fresh total.
    if (scr.t > 0.6) this.button('again', 'REPLAY', cx - 40, y + 114, 80, true);
  }

  hitButton(lx, ly) {
    const padding = 12;
    return this.buttons.find((b) => lx >= b.x - padding && lx <= b.x + b.w + padding && ly >= b.y - padding && ly <= b.y + b.h + padding)?.id;
  }
}

// Shortens text that would be wider than `max` pixels.
function fit(g, text, max) {
  if (g.textWidth(text) <= max) return text;
  let t = text;
  while (t.length > 1 && g.textWidth(`${t}...`) > max) t = t.slice(0, -1);
  return `${t}...`;
}
