import { WORLD, PHYS } from '../config.js';
import { BAIL_MESSAGES } from '../game.js';
import { PAL, RES } from './pixel.js';
import { PoseBlender, drawFigure, drawBoard, boardPitch, makeTransform } from './stickman.js';

// DOS-style renderer. The game world is 960x540 units; it is drawn into a
// 320x180 framebuffer (1 pixel = 3 units) using 4 colours, then scaled up
// with nearest-neighbour so every pixel stays chunky.

const S = 3;
const P = (v) => Math.round(v / S);
const { black, cyan, magenta, white } = PAL;
const pad = (n, len = 6) => String(Math.max(0, n)).padStart(len, '0');

// Deterministic skyline so the background never flickers between frames.
function skyline() {
  const out = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let x = -2; x < RES.W; ) {
    const w = 14 + Math.floor(rnd() * 22);
    const h = 10 + Math.floor(rnd() * 26);
    const windows = [];
    for (let wy = 4; wy < h - 4; wy += 5) for (let wx = 3; wx < w - 3; wx += 4) if (rnd() < 0.2) windows.push([wx, wy]);
    out.push({ x, w, h, windows });
    x += w + 3;
  }
  return out;
}

export class Renderer {
  constructor(pix) {
    this.g = pix;
    this.skyline = skyline();
    this.reset();
  }

  reset() {
    this.pose = new PoseBlender('idle');
    this.particles = [];
    this.popups = [];
    this.squash = 0;
    this.shake = 0;
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
          this.popup(e.name, e.x, e.y - 130, white);
          break;
        case 'bank':
          this.popup(e.mult > 1 ? `+${e.total} ${e.mult}X COMBO` : `+${e.total}`, e.x, e.y - 160, cyan);
          break;
        case 'bail':
          this.shake = 0.3;
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

    g.ox = this.shake > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;
    g.oy = this.shake > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;
    g.clear(black);
    this.drawBackground(game);
    const hint = game.grindHint();
    for (const o of game.level.obstacles) o.draw(g, { hint, time: this.time });
    this.drawSkater(game);
    this.drawParticles();
    g.ox = g.oy = 0;
    this.drawPopups();
    this.drawHud(game, opts);
    this.drawOverlay(game);
    g.flush();
  }

  step(game, dt) {
    this.squash = Math.max(0, this.squash - dt);
    this.shake = Math.max(0, this.shake - dt);
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

    // skyline: magenta outlines with cyan windows
    for (const b of this.skyline) {
      const top = G - b.h;
      g.line(b.x, top, b.x + b.w, top, magenta);
      g.line(b.x, top, b.x, G - 1, magenta);
      g.line(b.x + b.w, top, b.x + b.w, G - 1, magenta);
      for (const [wx, wy] of b.windows) g.pset(b.x + wx, top + wy, cyan);
    }

    // ground: cyan line, dithered pavement below
    g.line(0, G, RES.W - 1, G, cyan);
    for (let y = G + 3; y < RES.H; y += 3) {
      for (let x = (y / 3) % 2 ? 0 : 3; x < RES.W; x += 6) g.pset(x, y, magenta);
    }

    // take-off mark (tutorial levels)
    const th = game.level.takeoffHint;
    if (th && game.phase !== 'complete') {
      for (let x = P(th.x1); x <= P(th.x2); x += 3) g.line(x, G + 3, x + 1, G + 3, white);
      g.fill(P((th.x1 + th.x2) / 2) - 12, G + 7, 25, 9, black);
      g.text('POP', P((th.x1 + th.x2) / 2), G + 8, white, 1, 'center');
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
      const onGround = b.y >= WORLD.GROUND - 0.5 && b.vy === 0;
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

    const pitch = s.mode === 'air' ? boardPitch(s.vy) : 0;
    const tf = makeTransform(s.x, s.y, pitch);
    let spin = 0;
    let lift = 0;
    if (s.flip) {
      const p = s.flip.t / PHYS.FLIP_TIME;
      spin = p * Math.PI * 2;
      lift = Math.sin(p * Math.PI) * 12;
    }
    drawBoard(g, tf, spin, lift);
    drawFigure(g, tf, this.pose.pose);
  }

  drawParticles() {
    for (const p of this.particles) {
      const c = p.kind === 'spark' ? (Math.random() < 0.5 ? white : cyan) : magenta;
      this.g.pset(P(p.x), P(p.y), c);
    }
  }

  drawPopups() {
    for (const p of this.popups) {
      if (p.life < 0.3 && Math.floor(p.life * 20) % 2) continue; // blink out
      this.g.text(p.text, P(p.x), P(p.y), p.color, 1, 'center');
    }
  }

  drawHud(game, opts) {
    const g = this.g;
    g.text(`LEVEL ${game.levelNumber || 1}: ${game.level.name}`, 4, 4, white);
    g.text(`SCORE ${pad(game.score)}`, RES.W - 4, 4, white, 1, 'right');
    g.text(`HI ${pad(game.best || 0)}`, RES.W - 4, 13, cyan, 1, 'right');
    if (game.combo.length && game.phase === 'playing') {
      g.text(game.combo.map((t) => t.name).join(' + '), 4, 13, cyan);
    }
    if (opts.portrait) g.text('TURN DEVICE SIDEWAYS', RES.W / 2, 22, magenta, 1, 'center');
  }

  blink(rate = 3) {
    return Math.floor(this.time * rate * 2) % 2 === 0;
  }

  drawOverlay(game) {
    const g = this.g;
    this.buttons = [];
    const cx = RES.W / 2;

    if (game.phase === 'ready') {
      g.text('STICKFLIP', cx + 1, 37, magenta, 4, 'center');
      g.text('STICKFLIP', cx, 36, white, 4, 'center');
      g.text(game.level.hint, cx, 74, white, 1, 'center');
      if (this.blink()) g.text('TAP TO START', cx, 90, cyan, 1, 'center');
    } else if (game.phase === 'bailed') {
      g.text('BAIL!', cx, 36, magenta, 3, 'center');
      g.text(BAIL_MESSAGES[game.bailReason] || '', cx, 64, white, 1, 'center');
      if (game.phaseTime >= PHYS.BAIL_RETRY_DELAY && this.blink()) g.text('TAP TO TRY AGAIN', cx, 80, cyan, 1, 'center');
    } else if (game.phase === 'complete' && game.phaseTime > 0.35) {
      this.drawComplete(game);
    }
  }

  drawComplete(game) {
    const g = this.g;
    const cx = RES.W / 2;
    const [x, y, w, h] = [50, 26, 220, 104];
    g.fill(x, y, w, h, black);
    g.rect(x, y, w, h, white);
    g.rect(x + 2, y + 2, w - 4, h - 4, white);

    g.text('LANDED IT!', cx, y + 9, cyan, 2, 'center');
    g.text(`SCORE ${pad(game.score)}`, cx, y + 29, white, 1, 'center');
    const stars = [0, 1, 2].map((i) => (i < game.stars ? '*' : '-')).join(' ');
    g.text(stars, cx, y + 41, game.stars === 3 ? cyan : magenta, 2, 'center');
    const s = game.level.stars;
    const tip = game.stars < 3 ? `NEXT STAR: ${s[game.stars]} PTS. TRY A KICKFLIP!` : 'PERFECT RUN!';
    g.text(tip, cx, y + 60, white, 1, 'center');

    this.button('retry', 'RIDE AGAIN', x + 12, y + 78, 92, true);
    this.button('next', game.hasNext ? 'NEXT LEVEL' : 'MORE SOON', x + w - 104, y + 78, 92, game.hasNext);
  }

  button(id, label, x, y, w, enabled) {
    const g = this.g;
    const h = 15;
    if (enabled) {
      g.fill(x, y, w, h, id === 'next' ? cyan : white);
      g.text(label, x + w / 2, y + 4, black, 1, 'center');
      // hit box in world units
      this.buttons.push({ id, x: x * S, y: y * S, w: w * S, h: h * S });
    } else {
      g.rect(x, y, w, h, magenta);
      g.text(label, x + w / 2, y + 4, magenta, 1, 'center');
    }
  }

  hitButton(lx, ly) {
    const padding = 12;
    return this.buttons.find((b) => lx >= b.x - padding && lx <= b.x + b.w + padding && ly >= b.y - padding && ly <= b.y + b.h + padding)?.id;
  }
}
