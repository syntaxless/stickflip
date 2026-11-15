import { WORLD, PHYS } from '../config.js';
import { BAIL_MESSAGES } from '../game.js';
import { INK, PoseBlender, drawFigure, drawBoard, boardPitch } from './stickman.js';

const FONT = "'Permanent Marker', 'Marker Felt', 'Comic Sans MS', cursive";
const PAPER_TOP = '#fdf6e3';
const PAPER_BOTTOM = '#f1dfbd';
const GROUND_FILL = '#d8cdb8';

// Deterministic skyline so the background never flickers between frames.
function skyline(fromX, toX) {
  const out = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let x = Math.floor(fromX / 60) * 60 - 240; x < toX; ) {
    const w = 40 + rnd() * 70;
    out.push({ x, w, h: 60 + rnd() * 150 });
    x += w + 6;
  }
  return out;
}

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.reset();
    this.skyline = skyline(-1200, 2200);
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
          this.dust(e.x, e.y, 6);
          break;
        case 'land':
          this.squash = 0.18;
          this.dust(e.x, e.y, 10);
          break;
        case 'grind':
          this.sparks(e.x, e.y, 14);
          break;
        case 'trick':
          this.popup(e.name, e.x, e.y - 130, '#1b1b1f', 22);
          break;
        case 'bank':
          this.popup(e.mult > 1 ? `+${e.total}  (${e.mult}x COMBO)` : `+${e.total}`, e.x, e.y - 160, '#e4572e', 28);
          break;
        case 'bail':
          this.shake = 0.35;
          this.dust(e.x, e.y, 16);
          break;
      }
    }
  }

  dust(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({ kind: 'dust', x: x + (Math.random() - 0.5) * 40, y, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 90, life: 0.5, max: 0.5, r: 3 + Math.random() * 4 });
    }
  }

  sparks(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({ kind: 'spark', x: x + (Math.random() - 0.5) * 30, y: y - 2, vx: -80 - Math.random() * 260, vy: -60 - Math.random() * 260, life: 0.32, max: 0.32 });
    }
  }

  popup(text, x, y, color, size) {
    this.popups.push({ text, x: Math.max(110, Math.min(WORLD.W - 110, x)), y, color, size, life: 1.2, max: 1.2 });
  }

  // ----------------------------------------------------------- drawing

  draw(game, dt, view) {
    const ctx = this.ctx;
    this.time += dt;
    this.frameDt = dt;
    this.step(game, dt);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, view.cw, view.ch);
    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * 12 * this.shake : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * 12 * this.shake : 0;
    const k = view.dpr * view.scale;
    ctx.setTransform(k, 0, 0, k, view.dpr * view.ox + shakeX, view.dpr * view.oy + shakeY);

    // Visible area in world coordinates (wider/taller than the stage on most screens).
    const vis = {
      x0: -view.ox / view.scale - 20,
      y0: -view.oy / view.scale - 20,
      x1: (view.cw / view.dpr - view.ox) / view.scale + 20,
      y1: (view.ch / view.dpr - view.oy) / view.scale + 20,
    };

    this.drawBackground(ctx, game, vis);
    const hint = game.grindHint();
    for (const o of game.level.obstacles) o.draw(ctx, { hint, time: this.time });
    this.drawSkater(ctx, game);
    this.drawParticles(ctx);
    this.drawPopups(ctx);
    this.drawHud(ctx, game, vis);
    this.drawOverlay(ctx, game);
  }

  step(game, dt) {
    this.squash = Math.max(0, this.squash - dt);
    this.shake = Math.max(0, this.shake - dt);
    if (game.sk.mode === 'grind' && Math.random() < 0.8) this.sparks(game.sk.x, game.sk.y, 2);
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.kind === 'spark' ? 1400 : 120) * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.popups) {
      p.life -= dt;
      p.y -= 40 * dt;
    }
    this.popups = this.popups.filter((p) => p.life > 0);
  }

  drawBackground(ctx, game, vis) {
    const G = WORLD.GROUND;
    const sky = ctx.createLinearGradient(0, vis.y0, 0, G);
    sky.addColorStop(0, PAPER_TOP);
    sky.addColorStop(1, PAPER_BOTTOM);
    ctx.fillStyle = sky;
    ctx.fillRect(vis.x0, vis.y0, vis.x1 - vis.x0, G - vis.y0);

    // sun
    ctx.fillStyle = 'rgba(228, 87, 46, 0.18)';
    ctx.beginPath();
    ctx.arc(800, 110, 54, 0, Math.PI * 2);
    ctx.fill();

    // skyline
    ctx.fillStyle = 'rgba(27, 27, 31, 0.07)';
    for (const b of this.skyline) {
      if (b.x + b.w < vis.x0 || b.x > vis.x1) continue;
      ctx.fillRect(b.x, G - 40 - b.h, b.w, b.h + 40);
    }

    // ground
    ctx.fillStyle = GROUND_FILL;
    ctx.fillRect(vis.x0, G, vis.x1 - vis.x0, vis.y1 - G);
    ctx.strokeStyle = 'rgba(27,27,31,0.15)';
    ctx.lineWidth = 2;
    for (let x = Math.floor(vis.x0 / 160) * 160; x < vis.x1; x += 160) {
      ctx.beginPath();
      ctx.moveTo(x, G + 6);
      ctx.lineTo(x - 30, vis.y1);
      ctx.stroke();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(vis.x0, G);
    ctx.lineTo(vis.x1, G);
    ctx.stroke();

    // chalk take-off mark (tutorial levels)
    const th = game.level.takeoffHint;
    if (th && game.phase !== 'complete') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(th.x1, G + 14);
      ctx.lineTo(th.x2, G + 14);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('POP HERE', (th.x1 + th.x2) / 2, G + 42);
      ctx.restore();
    }
  }

  drawSkater(ctx, game) {
    const s = game.sk;
    const dt = this.frameDt || 1 / 60;

    if (s.mode === 'bail' && s.bail) {
      const b = s.bail;
      this.pose.update('bail', dt, 10);
      // board
      ctx.save();
      ctx.translate(b.bx, b.by);
      ctx.rotate(b.bang * 0.15);
      drawBoard(ctx, b.bang);
      ctx.restore();
      // body tumbles around the hip, settling on its side
      const onGround = b.y >= WORLD.GROUND - 0.5 && b.vy === 0;
      const ang = onGround ? Math.sign(b.ang || 1) * Math.min(Math.abs(b.ang), Math.PI / 2) : b.ang;
      const hip = this.pose.pose.hip;
      ctx.save();
      ctx.translate(b.x, b.y - (onGround ? 12 : 40));
      ctx.rotate(ang);
      ctx.translate(-hip.x, -hip.y);
      drawFigure(ctx, this.pose.pose);
      ctx.restore();
      return;
    }

    let target = 'roll';
    if (game.phase === 'ready') target = 'idle';
    else if (s.mode === 'grind') target = 'grind';
    else if (s.mode === 'air') target = s.flip ? 'flip' : s.primed ? 'prime' : 'air';
    else if (this.squash > 0) target = 'crouch';
    this.pose.update(target, dt);

    ctx.save();
    ctx.translate(s.x, s.y);
    const pitch = s.mode === 'air' ? boardPitch(s.vy) : 0;
    ctx.rotate(pitch);
    if (game.phase === 'ready') ctx.translate(0, Math.sin(this.time * 3) * 0.8);

    let spin = 0;
    let lift = 0;
    if (s.flip) {
      const p = s.flip.t / PHYS.FLIP_TIME;
      spin = p * Math.PI * 2;
      lift = Math.sin(p * Math.PI) * 12;
    }
    ctx.save();
    ctx.translate(0, -lift);
    drawBoard(ctx, spin);
    ctx.restore();
    drawFigure(ctx, this.pose.pose);
    ctx.restore();
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.max);
      if (p.kind === 'spark') {
        ctx.strokeStyle = `rgba(255, ${150 + Math.floor(Math.random() * 90)}, 20, ${a})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(120, 105, 85, ${a * 0.5})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 4, p.r * (1.6 - a), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawPopups(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    for (const p of this.popups) {
      const a = Math.min(1, p.life / (p.max * 0.4));
      ctx.globalAlpha = a;
      ctx.font = `${p.size}px ${FONT}`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = PAPER_TOP;
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.restore();
  }

  drawHud(ctx, game, vis) {
    const top = Math.max(0, vis.y0 + 20) + 40;
    ctx.save();
    ctx.fillStyle = INK;
    ctx.textBaseline = 'alphabetic';
    ctx.font = `22px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`LEVEL ${game.levelNumber || 1} · ${game.level.name.toUpperCase()}`, 24, top);
    ctx.textAlign = 'right';
    ctx.font = `30px ${FONT}`;
    ctx.fillText(String(game.score), WORLD.W - 24, top + 2);
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = 'rgba(27,27,31,0.6)';
    ctx.fillText(`BEST ${game.best || 0}`, WORLD.W - 24, top + 24);
    if (vis.y0 < -150) {
      // Tall portrait screen: the stage is small, suggest landscape.
      ctx.textAlign = 'center';
      ctx.font = `20px ${FONT}`;
      ctx.fillStyle = 'rgba(27,27,31,0.55)';
      ctx.fillText('Turn your phone sideways for a bigger view ↻', WORLD.W / 2, top - 70);
    }
    if (game.combo.length && game.phase === 'playing') {
      ctx.fillStyle = '#e4572e';
      ctx.textAlign = 'left';
      ctx.font = `18px ${FONT}`;
      ctx.fillText(game.combo.map((t) => t.name).join(' + '), 24, top + 28);
    }
    ctx.restore();
  }

  drawOverlay(ctx, game) {
    this.buttons = [];
    const cx = WORLD.W / 2;
    ctx.save();
    ctx.textAlign = 'center';

    if (game.phase === 'ready') {
      ctx.fillStyle = INK;
      ctx.font = `76px ${FONT}`;
      ctx.fillText('STICKFLIP', cx, 170);
      ctx.font = `22px ${FONT}`;
      ctx.fillStyle = 'rgba(27,27,31,0.75)';
      ctx.fillText(game.level.hint, cx, 215);
      const a = 0.55 + 0.45 * Math.sin(this.time * 4);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#e4572e';
      ctx.font = `30px ${FONT}`;
      ctx.fillText('TAP TO ROLL IN', cx, 275);
    } else if (game.phase === 'bailed') {
      ctx.fillStyle = '#e4572e';
      ctx.font = `64px ${FONT}`;
      ctx.fillText('BAIL!', cx, 160);
      ctx.fillStyle = INK;
      ctx.font = `22px ${FONT}`;
      ctx.fillText(BAIL_MESSAGES[game.bailReason] || '', cx, 200);
      if (game.phaseTime >= PHYS.BAIL_RETRY_DELAY) {
        ctx.globalAlpha = 0.55 + 0.45 * Math.sin(this.time * 4);
        ctx.font = `28px ${FONT}`;
        ctx.fillText('TAP TO TRY AGAIN', cx, 255);
      }
    } else if (game.phase === 'complete' && game.phaseTime > 0.35) {
      this.drawComplete(ctx, game);
    }
    ctx.restore();
  }

  drawComplete(ctx, game) {
    const cx = WORLD.W / 2;
    const pw = 460;
    const ph = 300;
    const px = cx - pw / 2;
    const py = 70;
    ctx.fillStyle = 'rgba(253, 246, 227, 0.95)';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = INK;
    ctx.font = `46px ${FONT}`;
    ctx.fillText('LANDED IT!', cx, py + 62);
    ctx.font = `28px ${FONT}`;
    ctx.fillText(`${game.score} pts`, cx, py + 104);

    for (let i = 0; i < 3; i++) {
      drawStar(ctx, cx + (i - 1) * 70, py + 160, 26, i < game.stars);
    }
    const next = game.stars < 3 ? nextStarTip(game) : 'Perfect run!';
    ctx.font = `17px ${FONT}`;
    ctx.fillStyle = 'rgba(27,27,31,0.7)';
    ctx.fillText(next, cx, py + 212);

    const bw = 180;
    const bh = 52;
    const by = py + ph - bh - 22;
    this.button(ctx, 'retry', 'RIDE AGAIN', cx - bw - 10, by, bw, bh, true);
    this.button(ctx, 'next', game.hasNext ? 'NEXT LEVEL' : 'MORE SOON', cx + 10, by, bw, bh, game.hasNext);
  }

  button(ctx, id, label, x, y, w, h, enabled) {
    ctx.fillStyle = enabled ? (id === 'next' ? '#e4572e' : INK) : 'rgba(27,27,31,0.2)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.fillStyle = enabled ? '#fffaf0' : 'rgba(27,27,31,0.5)';
    ctx.font = `22px ${FONT}`;
    ctx.fillText(label, x + w / 2, y + h / 2 + 8);
    if (enabled) this.buttons.push({ id, x, y, w, h });
  }

  hitButton(lx, ly) {
    const pad = 10;
    return this.buttons.find((b) => lx >= b.x - pad && lx <= b.x + b.w + pad && ly >= b.y - pad && ly <= b.y + b.h + pad)?.id;
  }
}

function nextStarTip(game) {
  const s = game.level.stars;
  const need = s[game.stars];
  return need != null ? `${need} pts for the next star. Try a kickflip into or out of the grind.` : '';
}

function drawStar(ctx, x, y, r, filled) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#f6b700' : 'rgba(27,27,31,0.08)';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
