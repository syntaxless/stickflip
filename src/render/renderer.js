import { WORLD, PHYS } from '../config.js';
import { BAIL_MESSAGES } from '../game.js';
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

  reset() {
    this.pose = new PoseBlender('idle');
    this.particles = [];
    this.popups = [];
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
        case 'trick':
          this.popup(e.name, e.x, e.y - 130, red);
          break;
        case 'bank':
          this.popup(e.mult > 1 ? `+${e.total} ${e.mult}X COMBO` : `+${e.total}`, e.x, e.y - 160, red);
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

  popup(text, x, y, color) {
    const half = (text.length * 6 * S) / 2 + 6;
    this.popups.push({ text, x: Math.max(half, Math.min(WORLD.W - half, x)), y, color, life: 1.1 });
  }

  // ----------------------------------------------------------- drawing

  draw(game, dt, opts = {}) {
    const g = this.g;
    this.time += dt;
    this.frameDt = dt;
    this.step(game, dt);

    g.clear(sky);
    this.drawBackground(game);
    for (const o of game.level.obstacles) o.draw(g, { time: this.time });
    this.drawSkater(game);
    this.drawParticles();
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
    for (const p of this.popups) {
      p.life -= dt;
      p.y -= 40 * dt;
    }
    this.popups = this.popups.filter((p) => p.life > 0);
  }

  drawBackground(game) {
    const g = this.g;
    const G = P(WORLD.GROUND);

    // ground: solid black, column by column so gaps, platforms and stairs
    // all come from the level's ground segments
    for (let x = 0; x < RES.W; x++) {
      const top = P(game.groundAt(x * S + S / 2).y);
      if (top < RES.H) g.fill(x, top, 1, RES.H - top, ink);
    }

    // take-off mark (tutorial levels)
    const th = game.level.takeoffHint;
    if (th && game.phase !== 'complete') {
      for (let x = P(th.x1); x <= P(th.x2); x += 3) g.line(x, G + 3, x + 1, G + 3, red);
      g.text('POP', P((th.x1 + th.x2) / 2), G + 8, red, 1, 'center');
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
    else if (this.squash > 0) target = 'crouch';
    this.pose.update(target, dt);

    // board tilts with the arc in the air, and with the rail on a sloped grind
    let pitch = s.mode === 'air' ? boardPitch(s.vy) : 0;
    if (s.mode === 'grind') {
      const r = s.grind.surface;
      if (r.y1 !== undefined) pitch = Math.atan2(r.y2 - r.y1, r.x2 - r.x1);
      pitch += s.grind.type.pitch; // 5-0 tips the nose up, nose grind tips it down
    }
    const base = makeTransform(s.x, s.y, pitch);
    // Side view, so turning around the vertical axis is drawn by squashing x:
    // cos() goes 1 -> 0 (edge-on) -> -1 (facing back) -> 1.
    const squashX = (tf, sx) => (p) => tf({ x: p.x * sx, y: p.y });
    let spin = 0; // board roll around its long axis
    let lift = 0;
    let boardSx = 1;
    let bodySx = 1;
    if (s.flip) {
      const { trick } = s.flip;
      const p = Math.min(1, s.flip.t / trick.dur);
      const turn = (n) => Math.cos(p * Math.PI * n);
      lift = Math.sin(p * Math.PI) * 12;
      switch (trick.board) {
        case 'flip': spin = p * Math.PI * 2; break;
        case 'flipRev': spin = -p * Math.PI * 2; break;
        case 'shove': boardSx = turn(1); break;
        case 'treflip': spin = p * Math.PI * 2; boardSx = turn(2); break;
        case 'hardflip': spin = p * Math.PI * 2; boardSx = turn(1); break;
      }
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

  drawPopups(inset = 0) {
    for (const p of this.popups) {
      if (p.life < 0.3 && Math.floor(p.life * 20) % 2) continue; // blink out
      // keep the text inside the visible part of the screen
      const half = this.g.textWidth(p.text) / 2 + 2;
      const x = Math.max(inset + half, Math.min(RES.W - inset - half, P(p.x)));
      this.g.text(p.text, x, P(p.y), p.color, 1, 'center');
    }
  }

  // `inset` is how many pixels at each side are cropped off (zoomed portrait view).
  drawHud(game, opts, inset = 0) {
    const g = this.g;
    const L = 4 + inset;
    const R = RES.W - 4 - inset;
    g.text(`LEVEL ${game.levelNumber || 1}: ${game.level.name}`, L, 4, red);
    g.text(`SCORE ${pad(game.score)}`, R, 4, red, 1, 'right');
    g.text(`HI ${pad(game.best || 0)}`, R, 13, red, 1, 'right');
    if (opts.total != null) g.text(`TOTAL ${pad(opts.total)}`, R, 22, red, 1, 'right');
    if (game.combo.length && game.phase === 'playing') {
      g.text(game.combo.map((t) => t.name).join(' + '), L, 13, red);
    }
    if (opts.portrait) g.text('TURN DEVICE SIDEWAYS', RES.W / 2, 31, red, 1, 'center');
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

    if (game.phase === 'ready') {
      g.text('STICKFLIP', cx + 1, 37, ink, 4, 'center');
      g.text('STICKFLIP', cx, 36, red, 4, 'center');
      // Arcade attract mode: on the first level, take turns with the high scores.
      const showTable = opts.attract && opts.highScores?.length && Math.floor(this.time / 4) % 2 === 1;
      if (showTable) {
        g.text('HIGH SCORES', cx, 64, red, 1, 'center');
        this.drawTable(opts.highScores, 74, -1, 9);
      } else {
        g.text(game.level.hint, cx, 70, red, 1, 'center');
        g.text('SWIPE IN THE AIR FOR MORE TRICKS.', cx, 80, red, 1, 'center');
      }
      if (this.blink()) g.text('TAP TO START', cx, showTable ? 124 : 94, red, 1, 'center');
    } else if (game.phase === 'bailed') {
      g.text('BAIL!', cx + 1, 37, ink, 3, 'center');
      g.text('BAIL!', cx, 36, red, 3, 'center');
      g.text(BAIL_MESSAGES[game.bailReason] || '', cx, 64, red, 1, 'center');
      if (game.phaseTime >= PHYS.BAIL_RETRY_DELAY && this.blink()) g.text('TAP TO TRY AGAIN', cx, 80, red, 1, 'center');
    } else if (game.phase === 'complete' && game.phaseTime > 0.35) {
      this.drawComplete(game);
    }
  }

  drawComplete(game) {
    const g = this.g;
    const cx = RES.W / 2;
    const [x, y, w, h] = [36, 34, 248, 104];
    g.fill(x, y, w, h, ink);
    g.rect(x, y, w, h, red);
    g.rect(x + 2, y + 2, w - 4, h - 4, red);

    g.text('LANDED IT!', cx, y + 9, red, 2, 'center');
    g.text(`SCORE ${pad(game.score)}`, cx, y + 29, red, 1, 'center');
    const stars = [0, 1, 2].map((i) => (i < game.stars ? '*' : '-')).join(' ');
    g.text(stars, cx, y + 41, red, 2, 'center');
    const s = game.level.stars;
    const tip = game.stars < 3 ? `NEXT STAR: ${s[game.stars]} PTS. TRY SOME FLIPS!` : 'PERFECT RUN!';
    g.text(tip, cx, y + 60, red, 1, 'center');

    this.button('retry', 'RIDE AGAIN', x + 12, y + 78, 92, true);
    this.button('next', game.hasNext ? 'NEXT LEVEL' : 'FINISH RUN', x + w - 104, y + 78, 92, true);
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
    const [x, y, w, h] = [56, 34, 208, 136];
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
    g.text(`RUN TOTAL ${pad(scr.score)}`, cx, y + 28, red, 1, 'center');
    g.text('ENTER YOUR INITIALS', cx, y + 40, red, 1, 'center');
    const left = cx - 72;
    for (let i = 0; i < INITIALS; i++) {
      const lx = left + i * 26;
      this.button(`up${i}`, '+', lx, y + 52, 20, true);
      if (i !== scr.pos || this.blink(2)) g.text(scr.letters[i], lx + 10, y + 74, red, 2, 'center');
      if (i === scr.pos) g.line(lx + 2, y + 90, lx + 17, y + 90, red);
      this.button(`dn${i}`, '-', lx, y + 94, 20, true);
    }
    this.button('ok', 'OK', left + INITIALS * 26 + 8, y + 73, 32, true);
  }

  drawScores(scr, list) {
    const g = this.g;
    const cx = RES.W / 2;
    const { y } = this.panel('HIGH SCORES');
    if (scr.score != null) g.text(`YOUR RUN: ${pad(scr.score)}`, cx, y + 28, red, 1, 'center');
    if (list.length) this.drawTable(list, y + 44, scr.highlight);
    else g.text('NO SCORES YET', cx, y + 60, red, 1, 'center');
    // Beat the game: start over from level 1 with a fresh total.
    if (scr.t > 0.6) this.button('again', 'PLAY AGAIN FROM LEVEL 1', cx - 80, y + 114, 160, true);
  }

  hitButton(lx, ly) {
    const padding = 12;
    return this.buttons.find((b) => lx >= b.x - padding && lx <= b.x + b.w + padding && ly >= b.y - padding && ly <= b.y + b.h + padding)?.id;
  }
}
