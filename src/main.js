import { WORLD } from './config.js';
import { Game } from './game.js';
import { LEVELS } from './levels/index.js';
import { Renderer } from './render/renderer.js';

const STEP = 1 / 120; // fixed physics step so jumps feel the same on every device

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const renderer = new Renderer(ctx);
const view = { scale: 1, ox: 0, oy: 0, dpr: 1, cw: 0, ch: 0 };

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
  view.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  view.cw = Math.round(w * view.dpr);
  view.ch = Math.round(h * view.dpr);
  canvas.width = view.cw;
  canvas.height = view.ch;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  // Fit the whole 960x540 stage; the background fills any extra space.
  view.scale = Math.min(w / WORLD.W, h / WORLD.H);
  view.ox = (w - WORLD.W * view.scale) / 2;
  view.oy = (h - WORLD.H * view.scale) / 2;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);

// ------------------------------------------------------------ input

function toWorld(clientX, clientY) {
  return { x: (clientX - view.ox) / view.scale, y: (clientY - view.oy) / view.scale };
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

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (e.isPrimary === false) return; // ignore extra fingers
  press(e.clientX, e.clientY);
});
// Stop iOS from treating quick taps as zoom/scroll gestures.
canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') {
    e.preventDefault();
    press();
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
  renderer.consume(events);
  renderer.draw(game, dt, view);
  requestAnimationFrame(frame);
}

resize();
loadLevel(levelIndex);
requestAnimationFrame(frame);
