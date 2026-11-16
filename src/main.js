import { WORLD, SCOREBOARD } from './config.js';
import { Game } from './game.js';
import { LEVELS, SECRET } from './levels/index.js';
import { Renderer } from './render/renderer.js';
import { Pix, RES, PAL } from './render/pixel.js';
import * as audio from './audio.js';
import { classifyStroke } from './gesture.js';
import { watchForUpdates } from './update.js';
import { localLeaderboard, supabaseLeaderboard, withFallback, INITIALS } from './leaderboard.js';
import { Run } from './run.js';

const STEP = 1 / 120; // fixed physics step so jumps feel the same on every device

// The game draws into a 320x180 framebuffer, which is then blown up onto the
// screen canvas with nearest-neighbour scaling for chunky DOS pixels.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const low = document.createElement('canvas');
low.width = RES.W;
low.height = RES.H;
const renderer = new Renderer(new Pix(low.getContext('2d')));

const view = { scale: 1, ox: 0, oy: 0, dpr: 1, portrait: false, inset: 0 };

// ------------------------------------------------------------ progress

// Testing: on /unstable/ or a local copy, ?level=1..6 (or ?level=secret)
// starts straight on that level. Test play keeps its own saves and its own
// on-device high scores, so it never touches real progress or the shared table.
const IS_LOCAL = /^(localhost|127\.|\[::1\])/.test(location.hostname);
const IS_UNSTABLE = location.pathname.includes('/unstable');
const TEST_LEVEL = IS_LOCAL || IS_UNSTABLE ? new URLSearchParams(location.search).get('level') : null;
const TESTING = TEST_LEVEL != null;

// The /unstable/ preview shares an origin with the live game, so keep its saves apart.
const SAVE_PREFIX = (IS_UNSTABLE ? 'stickflip-unstable' : 'stickflip') + (TESTING ? '-test' : '');
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

// ------------------------------------------------------------ run + high scores

// Shared between all players through Supabase when it's set up (see
// SCOREBOARD in config.js), with the on-device table as the fallback when it
// can't be reached. Local copies (localhost) only ever use the device table.
const localBoard = localLeaderboard(store);
const shared = SCOREBOARD.url && SCOREBOARD.key && !IS_LOCAL && !TESTING;
const board = shared ? withFallback(supabaseLeaderboard(SCOREBOARD), localBoard) : localBoard;
let highScores = [];
const refreshScores = () => board.top().then((list) => (highScores = list));
refreshScores();

// The secret level plays after level 6 from the third full clear of the run
// onwards, and counts toward the run total like any other level.
const SECRET_INDEX = LEVELS.length;
const SECRET_AFTER_CLEARS = 2; // full clears needed before the run that unlocks it
let clears = store.get('clears', 0);

let run = new Run(LEVELS.length + 1, store.get('run', null));

// End-of-run screens drawn over the game:
//   { type: 'entry', score, letters, pos, t }  typing initials for a new high score
//   { type: 'scores', score, highlight, t }    the table
let screen = null;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ '; // a space allows shorter names

async function finishRun() {
  const score = run.total();
  run = new Run(LEVELS.length + 1);
  store.set('run', run);
  clears += 1;
  store.set('clears', clears);
  if (await board.qualifies(score)) {
    const saved = String(store.get('initials', 'AAAA')).padEnd(INITIALS).slice(0, INITIALS);
    screen = { type: 'entry', score, letters: saved.split(''), pos: 0, t: 0 };
  } else {
    screen = { type: 'scores', score, highlight: -1, t: 0 };
  }
}

async function submitInitials() {
  const name = screen.letters.join('').trim() || 'ANON'.slice(0, INITIALS);
  store.set('initials', screen.letters.join(''));
  const { score } = screen;
  const highlight = await board.submit(name, score);
  await refreshScores();
  screen = { type: 'scores', score, highlight, t: 0 };
}

function cycleLetter(i, step) {
  const at = LETTERS.indexOf(screen.letters[i]);
  screen.letters[i] = LETTERS[(at + step + LETTERS.length) % LETTERS.length];
  screen.pos = i;
}

function screenPress(clientX, clientY) {
  if (screen.type === 'scores') {
    // REPLAY (the whole screen counts, so it's easy to hit): back to level 1
    // with a fresh run total. finishRun() already cleared the run.
    if (screen.t < 0.6) return;
    screen = null;
    loadLevel(0);
    return;
  }
  if (clientX == null) return submitInitials(); // keyboard confirm
  const p = toWorld(clientX, clientY);
  const id = renderer.hitButton(p.x, p.y);
  if (!id) return;
  if (id === 'ok') return submitInitials();
  cycleLetter(Number(id.slice(2)), id.startsWith('up') ? 1 : -1);
}

function loadLevel(i, autoStart = false) {
  levelIndex = i;
  if (i === 0) refreshScores(); // the title screen shows the table
  const secret = i === SECRET_INDEX;
  if (!secret) store.set('level', i);
  const level = secret ? SECRET : LEVELS[i];
  game = new Game(level);
  game.levelNumber = i + 1;
  if (secret) game.levelLabel = 'SECRET';
  if (TESTING) game.levelLabel = `TEST ${secret ? 'S' : i + 1}`;
  game.hasNext = i + 1 < LEVELS.length || (i === LEVELS.length - 1 && clears >= SECRET_AFTER_CLEARS);
  game.best = store.get(`best:${level.id}`, 0);
  renderer.reset();
  if (autoStart) game.tap();
}

// ------------------------------------------------------------ layout

// Most game pixels the portrait zoom may hide at each side. The rider starts
// 27 px from the left edge and the rail sits well inside, so 20 keeps all of
// the action on screen.
const MAX_PORTRAIT_CROP = 20;


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
  let k = fit >= 1 ? Math.floor(fit) : fit;
  // In portrait the width is the limit, and rounding down to whole pixels can
  // waste a lot of it. Zoom one step further if that only crops a sliver off
  // each side (empty sky and ground; the HUD moves inward to stay visible).
  if (h > w && fit >= 1) {
    const crop = (RES.W - (w * view.dpr) / (k + 1)) / 2; // game pixels lost per side
    if (crop <= MAX_PORTRAIT_CROP) k += 1;
  }
  view.scale = k / view.dpr; // CSS px per game pixel
  view.ox = Math.round(((w - RES.W * view.scale) / 2) * view.dpr) / view.dpr;
  view.oy = Math.round(((h - RES.H * view.scale) / 2) * view.dpr) / view.dpr;
  view.portrait = h > w;
  view.inset = Math.max(0, -view.ox / view.scale); // game pixels hidden at each side
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);

// ------------------------------------------------------------ input

function toWorld(clientX, clientY) {
  const u = WORLD.W / RES.W; // world units per game pixel
  return { x: ((clientX - view.ox) / view.scale) * u, y: ((clientY - view.oy) / view.scale) * u };
}

function press(clientX, clientY) {
  if (screen) return screenPress(clientX, clientY);
  if (game.phase === 'complete') {
    if (game.phaseTime < 0.35) return;
    const p = clientX == null ? null : toWorld(clientX, clientY);
    const id = p ? renderer.hitButton(p.x, p.y) : 'next'; // keyboard: carry on
    if (id === 'retry') loadLevel(levelIndex, true);
    else if (id === 'next') {
      if (game.hasNext) loadLevel(levelIndex + 1);
      else finishRun();
    }
    return;
  }
  game.tap();
}

// On the ground a touch charges an ollie: the skater crouches while the
// finger is down and pops when it lifts, higher the longer it was held (a
// quick tap is a normal ollie). Other taps act on touch-down for the lowest
// latency. In the air, a touch is followed until the finger lifts so it can
// be read as a tap or a swipe.
// Every touch while playing also counts as a hold: if the finger is still
// down when the skater reaches a rail, it locks a grind (drag forward for a
// nose grind, back for a 5-0), and the lift is then ignored.
let stroke = null; // { id, points, read } while a finger is down; read = classify on lift

const HOLD_DRAG = 22; // CSS px of sideways drag that picks a 5-0 / nose grind

function holdDir(points) {
  const a = points[0];
  const b = points[points.length - 1];
  const dx = b.x - a.x;
  if (Math.abs(dx) < HOLD_DRAG || Math.abs(dx) < Math.abs(b.y - a.y)) return null;
  return dx > 0 ? 'right' : 'left';
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (e.isPrimary === false) return; // ignore extra fingers
  audio.unlock();
  const inAir = game.phase === 'playing' && game.sk.mode === 'air';
  stroke = { id: e.pointerId, points: [{ x: e.clientX, y: e.clientY }], read: false, charge: false };
  canvas.setPointerCapture?.(e.pointerId);
  // On the ground, a touch charges an ollie: crouch while held, pop on lift.
  if (!screen && game.startCharge()) stroke.charge = true;
  // A tap that would lock a grind can't wait for the finger to lift.
  else if (!inAir || game.grindHint() === 'ready') press(e.clientX, e.clientY);
  else stroke.read = true;
  if (game.phase === 'playing') game.setHold(true);
});

canvas.addEventListener('pointermove', (e) => {
  if (!stroke || e.pointerId !== stroke.id) return;
  stroke.points.push({ x: e.clientX, y: e.clientY });
  if (game.hold) game.setHold(true, holdDir(stroke.points));
});

function endStroke(e) {
  if (!stroke || e.pointerId !== stroke.id) return;
  stroke.points.push({ x: e.clientX, y: e.clientY });
  const { read, points, charge } = stroke;
  stroke = null;
  if (charge) game.releaseCharge();
  const grinded = game.setHold(false);
  if (!read || grinded) return;
  // Landed while the finger was down: don't turn the gesture into an ollie.
  if (game.phase !== 'playing' || game.sk.mode !== 'air') return;
  const gesture = classifyStroke(points);
  if (gesture === 'tap') game.tap();
  else game.swipe(gesture);
}
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', (e) => {
  if (stroke && e.pointerId === stroke.id) {
    stroke = null;
    game.cancelCharge();
    game.setHold(false);
  }
});

// Stop iOS from treating quick taps as zoom/scroll gestures.
canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Keyboard: Space/Enter is the finger. In the air it acts on release (like a
// touch), so holding it through a rail grinds; an arrow held with it picks the
// grind (right: nose grind, left: 5-0). Arrows on their own are swipes.
const ARROWS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
let keyHold = null; // { read } while Space/Enter is down

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (screen) return screenKey(e);
  if (e.code === 'KeyM') {
    audio.toggleMute();
    return;
  }
  if (e.code === 'KeyB') {
    game.swipe('circle'); // backflip
    return;
  }
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    audio.unlock();
    const inAir = game.phase === 'playing' && game.sk.mode === 'air';
    keyHold = { read: inAir && game.grindHint() !== 'ready', charge: game.startCharge() };
    if (keyHold.charge) keyHold.read = false;
    else if (!keyHold.read) press();
    if (game.phase === 'playing') game.setHold(true);
    return;
  }
  const dir = ARROWS[e.code];
  if (dir) {
    e.preventDefault();
    audio.unlock();
    if (keyHold && game.hold) {
      if (dir === 'left' || dir === 'right') game.setHold(true, dir);
    } else if (game.phase === 'complete') press();
    else game.swipe(dir);
  }
});

// End-of-run screens: type initials (or use the arrows), Enter to confirm.
function screenKey(e) {
  if (screen.type === 'scores') {
    if (e.code === 'Space' || e.code === 'Enter') press();
    return;
  }
  const last = INITIALS - 1;
  if (/^Key[A-Z]$/.test(e.code) || e.code === 'Space') {
    screen.letters[screen.pos] = e.code === 'Space' ? ' ' : e.code.slice(3);
    screen.pos = Math.min(last, screen.pos + 1);
  } else if (e.code === 'Backspace' || e.code === 'ArrowLeft') screen.pos = Math.max(0, screen.pos - 1);
  else if (e.code === 'ArrowRight') screen.pos = Math.min(last, screen.pos + 1);
  else if (e.code === 'ArrowUp') cycleLetter(screen.pos, 1);
  else if (e.code === 'ArrowDown') cycleLetter(screen.pos, -1);
  else if (e.code === 'Enter') submitInitials();
  else return;
  e.preventDefault();
}

window.addEventListener('keyup', (e) => {
  if ((e.code === 'Space' || e.code === 'Enter') && keyHold) {
    const { read, charge } = keyHold;
    keyHold = null;
    if (charge) game.releaseCharge();
    const grinded = game.setHold(false);
    if (read && !grinded && game.phase === 'playing' && game.sk.mode === 'air') game.tap();
  } else if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && keyHold && game.hold) {
    game.setHold(true, null);
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
    if (e.type === 'complete') {
      run.recordClear(levelIndex, e.score);
      store.set('run', run);
      if (e.score > game.best) {
        game.best = e.score;
        store.set(`best:${game.level.id}`, e.score);
      }
    }
  }
  audio.play(events, game);
  renderer.consume(events);
  if (screen) screen.t += dt;
  renderer.draw(game, dt, {
    portrait: view.portrait,
    inset: view.inset,
    total: run.total(),
    screen,
    highScores,
    attract: levelIndex === 0,
  });

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
if (TESTING) {
  const n = TEST_LEVEL.toLowerCase() === 'secret' ? SECRET_INDEX + 1 : parseInt(TEST_LEVEL, 10);
  levelIndex = Number.isInteger(n) && n >= 1 && n <= SECRET_INDEX + 1 ? n - 1 : 0;
}
loadLevel(levelIndex);
requestAnimationFrame(frame);
watchForUpdates(() => game.phase === 'playing');
