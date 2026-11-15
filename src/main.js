import { WORLD } from './config.js';
import { Game } from './game.js';
import { LEVELS } from './levels/index.js';
import { Renderer } from './render/renderer.js';
import { Pix, RES } from './render/pixel.js';
import * as audio from './audio.js';
import { classifyStroke } from './gesture.js';

const STEP = 1 / 120; // fixed physics step so jumps feel the same on every device

// The game draws into a 320x180 framebuffer, which is then blown up onto the
// screen canvas with nearest-neighbour scaling for chunky DOS pixels.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const low = document.createElement('canvas');
low.width = RES.W;
low.height = RES.H;
const renderer = new Renderer(new Pix(low.getContext('2d')));
const view = { scale: 1, ox: 0, oy: 0, dpr: 1, portrait: false };

// ------------------------------------------------------------ progress

// The /unstable/ preview shares an origin with the live game, so keep its saves apart.
const SAVE_PREFIX = location.pathname.includes('/unstable') ? 'stickflip-unstable' : 'stickflip';
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(`${SAVE_PREFIX}:${key}`);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`${SAVE_PREFIX}:${key}`, JSON.stringify(value));
    } catch {
      /* private mode etc. Progress just isn't saved. */
    }
  },
};

let levelIndex = Math.min(store.get('level', 0), LEVELS.length - 1);
let game;

function loadLevel(i, autoStart = false) {
  levelIndex = i;
  store.set('level', i);
  game = new Game(LEVELS[i]);
  game.levelNumber = i + 1;
  game.hasNext = i + 1 < LEVELS.length;
  game.best = store.get(`best:${LEVELS[i].id}`, 0);
  renderer.reset();
  if (autoStart) game.tap();
}

// ------------------------------------------------------------ layout

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  view.dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(w * view.dpr);
  canvas.height = Math.round(h * view.dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  // Whole device pixels per game pixel keeps every pixel the same size.
  const fit = Math.min(w / RES.W, h / RES.H) * view.dpr;
  const k = fit >= 1 ? Math.floor(fit) : fit;
  view.scale = k / view.dpr; // CSS px per game pixel
  view.ox = Math.round(((w - RES.W * view.scale) / 2) * view.dpr) / view.dpr;
  view.oy = Math.round(((h - RES.H * view.scale) / 2) * view.dpr) / view.dpr;
  view.portrait = h > w;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);

// ------------------------------------------------------------ input

function toWorld(clientX, clientY) {
  const u = WORLD.W / RES.W; // world units per game pixel
  return { x: ((clientX - view.ox) / view.scale) * u, y: ((clientY - view.oy) / view.scale) * u };
}

function press(clientX, clientY) {
  if (game.phase === 'complete') {
    if (game.phaseTime < 0.35) return;
    const p = clientX == null ? null : toWorld(clientX, clientY);
    const id = p ? renderer.hitButton(p.x, p.y) : game.hasNext ? 'next' : 'retry';
    if (id === 'retry') loadLevel(levelIndex, true);
    else if (id === 'next') loadLevel(levelIndex + 1);
    return;
  }
  game.tap();
}

// Taps act on touch-down for the lowest latency. In the air, a touch is
// followed until the finger lifts so it can be read as a tap or a swipe.
let stroke = null; // { id, points } while following an air gesture

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (e.isPrimary === false) return; // ignore extra fingers
  audio.unlock();
  const inAir = game.phase === 'playing' && game.sk.mode === 'air';
  // A tap that would lock a grind can't wait for the finger to lift.
  if (!inAir || game.grindHint() === 'ready') {
    stroke = null;
    press(e.clientX, e.clientY);
    return;
  }
  stroke = { id: e.pointerId, points: [{ x: e.clientX, y: e.clientY }] };
  canvas.setPointerCapture?.(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (stroke && e.pointerId === stroke.id) stroke.points.push({ x: e.clientX, y: e.clientY });
});

function endStroke(e) {
  if (!stroke || e.pointerId !== stroke.id) return;
  stroke.points.push({ x: e.clientX, y: e.clientY });
  const gesture = classifyStroke(stroke.points);
  stroke = null;
  // Landed while the finger was down: don't turn the gesture into an ollie.
  if (game.phase !== 'playing' || game.sk.mode !== 'air') return;
  if (gesture === 'tap') game.tap();
  else game.swipe(gesture);
}
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', (e) => {
  if (stroke && e.pointerId === stroke.id) stroke = null;
});

// Stop iOS from treating quick taps as zoom/scroll gestures.
canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyM') {
    audio.toggleMute();
    return;
  }
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    audio.unlock();
    press();
    return;
  }
  // Arrow keys act as swipes (and as a tap when not in the air).
  const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.code];
  if (dir) {
    e.preventDefault();
    audio.unlock();
    if (game.phase === 'complete') press();
    else game.swipe(dir);
  }
});

// ------------------------------------------------------------ loop

let last = performance.now();
let acc = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  acc += dt;
  while (acc >= STEP) {
    game.update(STEP);
    acc -= STEP;
  }
  const events = game.drainEvents();
  for (const e of events) {
    if (e.type === 'bail' && navigator.vibrate) navigator.vibrate(60);
    if (e.type === 'complete' && e.score > game.best) {
      game.best = e.score;
      store.set(`best:${game.level.id}`, e.score);
    }
  }
  audio.play(events, game);
  renderer.consume(events);
  renderer.draw(game, dt, { portrait: view.portrait });

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Letterbox: navy sky above the ground line, black ground below it.
  const groundY = Math.round((view.oy + (WORLD.GROUND / (WORLD.W / RES.W)) * view.scale) * view.dpr);
  ctx.fillStyle = '#000080';
  ctx.fillRect(0, 0, canvas.width, groundY);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(low, view.ox * view.dpr, view.oy * view.dpr, RES.W * view.scale * view.dpr, RES.H * view.scale * view.dpr);
  requestAnimationFrame(frame);
}

resize();
loadLevel(levelIndex);
requestAnimationFrame(frame);
