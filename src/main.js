import { WORLD, SCOREBOARD } from './config.js';
import { Game } from './game.js';
import { LEVELS, SECRET } from './levels/index.js';
import { Renderer } from './render/renderer.js';
import { Pix, RES, setPalette } from './render/pixel.js';
import * as audio from './audio.js';
import { readStroke, readChargeStroke } from './gesture.js';
import { watchForUpdates } from './update.js';
import { localLeaderboard, supabaseLeaderboard, withFallback, INITIALS } from './leaderboard.js';
import { Run } from './run.js';
import { NATIVE, haptics, submitToGameCenter, gameCenterReady, refreshGameCenter, openGameCenter } from './native.js';

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
// The iOS app is served from capacitor://localhost but is a live copy of the
// game: it plays real runs and posts to the shared table.
const IS_LOCAL = !NATIVE && /^(localhost|127\.|\[::1\])/.test(location.hostname);
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
// can't be reached. Only the live site posts there: the /unstable/ preview
// and local copies only ever use their own device table (kept apart from the
// live one by SAVE_PREFIX).
const localBoard = localLeaderboard(store);
const shared = SCOREBOARD.url && SCOREBOARD.key && !IS_LOCAL && !IS_UNSTABLE && !TESTING;
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
  // No bails all the way through: the bonus goes on the total.
  const bonus = run.bonus();
  const score = run.total() + bonus;
  run = new Run(LEVELS.length + 1);
  store.set('run', run);
  clears += 1;
  store.set('clears', clears);
  submitToGameCenter(score);
  refreshGameCenter();
  if (await board.qualifies(score)) {
    const saved = String(store.get('initials', 'AAAA')).padEnd(INITIALS).slice(0, INITIALS);
    screen = { type: 'entry', score, bonus, letters: saved.split(''), pos: 0, t: 0 };
  } else {
    screen = { type: 'scores', score, bonus, highlight: -1, t: 0 };
  }
}

async function submitInitials() {
  const name = screen.letters.join('').trim() || 'ANON'.slice(0, INITIALS);
  store.set('initials', screen.letters.join(''));
  const { score, bonus } = screen;
  const highlight = await board.submit(name, score);
  await refreshScores();
  screen = { type: 'scores', score, bonus, highlight, t: 0 };
}

function cycleLetter(i, step) {
  const at = LETTERS.indexOf(screen.letters[i]);
  screen.letters[i] = LETTERS[(at + step + LETTERS.length) % LETTERS.length];
  screen.pos = i;
}

// Between level 6 and the secret level: a blinking banner in the secret
// palette ("SECRET LEVEL UNLOCKED" the first time), then the level loads.
const UNLOCK_TIME = 2.4;
function unlockSecret() {
  const first = !store.get('secretSeen', false);
  store.set('secretSeen', true);
  setPalette('secret');
  screen = { type: 'unlock', first, t: 0 };
}

function screenPress(clientX, clientY) {
  if (screen.type === 'unlock') {
    if (screen.t < 0.8) return; // a beat to read it, then a tap skips ahead
    screen = null;
    loadLevel(SECRET_INDEX);
    return;
  }
  if (screen.type === 'scores') {
    // REPLAY (the whole screen counts, so it's easy to hit): back to level 1
    // with a fresh run total. finishRun() already cleared the run.
    if (screen.t < 0.6) return;
    // In the app, the table also has a GAME CENTER button; anywhere else is REPLAY.
    if (clientX != null && gameCenterReady()) {
      const p = toWorld(clientX, clientY);
      if (renderer.hitButton(p.x, p.y) === 'gc') return openGameCenter();
    }
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

// `entry` ({ speed }) rolls straight onto the screen at that speed: the levels
// play as one continuous ride, each a screen the rider flips onto.
function loadLevel(i, autoStart = false, entry = null) {
  levelIndex = i;
  if (i === 0) refreshScores(); // the title screen shows the table
  const secret = i === SECRET_INDEX;
  if (!secret) store.set('level', i);
  const level = secret ? SECRET : LEVELS[i];
  const prev = game;
  game = new Game(level, entry);
  // A finger still down from the last screen keeps charging on this one.
  if (entry && prev?.sk.charge && game.startCharge()) {
    game.sk.charge.t = prev.sk.charge.t;
    game.setHold(true, prev.hold?.dir || null);
  } else if (entry) {
    if (stroke) stroke.charge = false;
    if (keyHold) keyHold.charge = false;
  }
  game.levelNumber = i + 1;
  if (secret) game.levelLabel = 'BONUS';
  setPalette(secret ? 'secret' : 'normal');
  if (TESTING) game.levelLabel = `TEST ${secret ? 'S' : i + 1}`;
  game.hasNext = i + 1 < LEVELS.length || (i === LEVELS.length - 1 && clears >= SECRET_AFTER_CLEARS);
  if (i === LEVELS.length - 1 && game.hasNext) game.nextLabel = 'BONUS LEVEL';
  game.best = store.get(`best:${level.id}`, 0);
  renderer.reset(!!entry);
  if (autoStart) game.tap();
}

// The rider left the screen: flip to the next level still rolling, or end the run.
function nextScreen() {
  const last = LEVELS.length - 1;
  if (levelIndex < last) loadLevel(levelIndex + 1, false, { speed: game.speed });
  else if (levelIndex === last && clears >= SECRET_AFTER_CLEARS) unlockSecret();
  else finishRun();
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
  if (game.phase === 'complete') return; // between screens / end of the run
  game.tap();
}

// On the ground a touch charges an ollie: the skater crouches while the
// finger is down and pops when it lifts, higher the longer it was held (a
// quick tap is a normal ollie). Holding also pushes (speeds up); drag forward
// while holding to push harder, back to brake. Draw a trick shape before
// lifting (after resting the finger, if you were dragging) and the ollie pops
// straight into that trick. Other taps act on touch-down for the lowest
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
  stroke = { id: e.pointerId, points: [{ x: e.clientX, y: e.clientY, t: e.timeStamp / 1000 }], read: false, charge: false, t0: performance.now() };
  canvas.setPointerCapture?.(e.pointerId);
  // On the ground, a touch charges an ollie: crouch while held, pop on lift.
  if (!screen && game.startCharge()) stroke.charge = true;
  // Riding up the quarter pipe: start drawing now, the trick goes on lift.
  else if (!screen && game.phase === 'playing' && game.sk.mode === 'ramp') stroke.read = true;
  // A tap that would lock a grind can't wait for the finger to lift.
  else if (!inAir || game.grindHint() === 'ready') press(e.clientX, e.clientY);
  else stroke.read = true;
  if (game.phase === 'playing') game.setHold(true);
});

canvas.addEventListener('pointermove', (e) => {
  if (!stroke || e.pointerId !== stroke.id) return;
  stroke.points.push({ x: e.clientX, y: e.clientY, t: e.timeStamp / 1000 });
  if (game.hold) game.setHold(true, holdDir(stroke.points));
});

function endStroke(e) {
  if (!stroke || e.pointerId !== stroke.id) return;
  stroke.points.push({ x: e.clientX, y: e.clientY, t: e.timeStamp / 1000 });
  const { read, points, charge, t0 } = stroke;
  stroke = null;
  const popped = charge && game.releaseCharge();
  const grinded = game.setHold(false);
  if (popped) {
    // Dragged a trick shape while charging: the ollie pops straight into it.
    const r = readChargeStroke(points);
    showStroke(points, r);
    if (r.key !== 'tap') game.swipe(r.key);
    return;
  }
  if (!read || grinded) return;
  // Landed while the finger was down: don't turn the gesture into an ollie.
  if (game.phase !== 'playing' || game.sk.mode !== 'air') return showStroke(points, { key: 'landed first' });
  const r = readStroke(points);
  showStroke(points, r);
  if (r.key === 'tap') game.tap();
  else game.swipe(r.key, (performance.now() - t0) / 1000);
}

// Test mode only (/unstable/?level=N or a local copy): draw each stroke on
// screen with what it was read as, to see why a gesture didn't work.
let lastStroke = null; // { points, label, t }
function showStroke(points, r) {
  if (!TESTING) return;
  const label = r.shape && r.shape !== r.key ? `${r.key} (${r.shape} ${r.d.toFixed(2)})` : r.d != null ? `${r.key} ${r.d.toFixed(2)}` : r.key;
  lastStroke = { points, label, t: performance.now() };
}
function drawStrokeDebug() {
  const live = stroke && stroke.points.length > 1 ? stroke.points : null;
  const shown = lastStroke && performance.now() - lastStroke.t < 2500 ? lastStroke : null;
  if (!live && !shown) return;
  const d = view.dpr;
  ctx.save();
  ctx.lineWidth = 3 * d;
  ctx.lineJoin = 'round';
  const path = (pts, color) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x * d, p.y * d) : ctx.moveTo(p.x * d, p.y * d)));
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillRect(pts[0].x * d - 4 * d, pts[0].y * d - 4 * d, 8 * d, 8 * d); // start
  };
  if (shown) {
    path(shown.points, '#ffff55');
    ctx.font = `${14 * d}px monospace`;
    ctx.fillStyle = '#ffff55';
    const p = shown.points[shown.points.length - 1];
    ctx.fillText(shown.label.toUpperCase(), Math.min(p.x * d + 8 * d, canvas.width - 260 * d), Math.max(p.y * d - 8 * d, 20 * d));
  }
  if (live) path(live, '#55ffff');
  ctx.restore();
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
// grind (right: nose grind, left: 5-0). Arrows on their own do tricks.
const ARROWS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
// Arrow keys on their own do a few of the tricks (the rest need a finger).
const ARROW_TRICK = { up: 'shove', down: 'heelflip', left: 'bs360', right: 'fs360' };
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
    else game.swipe(ARROW_TRICK[dir]);
  }
});

// End-of-run screens: type initials (or use the arrows), Enter to confirm.
function screenKey(e) {
  if (screen.type === 'unlock') {
    if (e.code === 'Space' || e.code === 'Enter') press();
    return;
  }
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
  let flip = false;
  for (const e of events) {
    if (e.type === 'bail') {
      if (navigator.vibrate && !NATIVE) navigator.vibrate(60);
      run.recordBail();
      store.set('run', run);
    }
    if (e.type === 'complete') {
      run.recordClear(levelIndex, e.score);
      store.set('run', run);
      if (e.score > game.best) {
        game.best = e.score;
        store.set(`best:${game.level.id}`, e.score);
      }
      flip = true;
    }
  }
  audio.play(events, game);
  haptics(events);
  renderer.consume(events);
  if (flip) nextScreen();
  if (screen) screen.t += dt;
  if (screen?.type === 'unlock' && screen.t >= UNLOCK_TIME) {
    screen = null;
    loadLevel(SECRET_INDEX);
  }
  renderer.draw(game, dt, {
    portrait: view.portrait,
    inset: view.inset,
    total: run.total(levelIndex, game.phase === 'bailed' ? 0 : game.score), // running total, this level included
    screen,
    highScores,
    gameCenter: gameCenterReady(),
    attract: levelIndex === 0,
  });

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawLetterbox();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(low, view.ox * view.dpr, view.oy * view.dpr, RES.W * view.scale * view.dpr, RES.H * view.scale * view.dpr);
  if (TESTING) drawStrokeDebug();
  requestAnimationFrame(frame);
}

// The bars around the game (a screen wider or taller than 16:9) show more of
// the same scene: the ground and obstacles are drawn again into a bigger
// framebuffer that covers the whole screen, and the game is drawn on top. So
// a rail, a ramp or a slope running off the edge of the game carries on.
const outer = { cv: document.createElement('canvas'), pix: null };
function drawLetterbox() {
  const k = view.scale * view.dpr; // device px per game pixel
  const ox = view.ox * view.dpr;
  const oy = view.oy * view.dpr;
  // game pixels needed on each side of the game to reach the screen's edges
  const left = Math.max(0, Math.ceil(ox / k));
  const top = Math.max(0, Math.ceil(oy / k));
  const right = Math.max(0, Math.ceil((canvas.width - ox) / k - RES.W));
  const bottom = Math.max(0, Math.ceil((canvas.height - oy) / k - RES.H));
  if (!left && !top && !right && !bottom) return; // the game fills the screen
  const W = left + RES.W + right;
  const H = top + RES.H + bottom;
  if (!outer.pix || outer.cv.width !== W || outer.cv.height !== H) {
    outer.cv.width = W;
    outer.cv.height = H;
    outer.pix = new Pix(outer.cv.getContext('2d'), W, H);
  }
  const cam = renderer.cam || { x: 0, y: 0 };
  renderer.drawScene(outer.pix, game, { x: cam.x - left, y: cam.y - top });
  outer.pix.flush();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(outer.cv, ox - left * k, oy - top * k, W * k, H * k);
}

resize();
if (TESTING) {
  const n = TEST_LEVEL.toLowerCase() === 'secret' ? SECRET_INDEX + 1 : parseInt(TEST_LEVEL, 10);
  levelIndex = Number.isInteger(n) && n >= 1 && n <= SECRET_INDEX + 1 ? n - 1 : 0;
}
loadLevel(levelIndex);
requestAnimationFrame(frame);
watchForUpdates(() => game.phase === 'playing');
