import { WORLD, PHYS } from '../config.js';
import { slopeOf, comboMult, manualWeight } from '../game.js';
import { PAL, RES } from './pixel.js';
import { INITIALS } from '../leaderboard.js';
import { PoseBlender, drawFigure, drawBoard, boardPitch, makeTransform } from './stickman.js';
import { drawSticker, loserSpot } from './sticker.js';
import { squashOf, RAG_SIZE } from '../ragdoll.js';

// Pixel-art renderer. The game world is 960x540 units; it is drawn into a
// 320x180 framebuffer (1 pixel = 3 units), then scaled up with
// nearest-neighbour so every pixel stays chunky.

const S = 3;
const P = (v) => Math.round(v / S);
// A world position snapped to a whole game pixel. The rider's anchor is drawn
// snapped, so its limbs round the same way every frame instead of shimmering.
const snap = (v) => Math.round(v / S) * S;
const CONC = [190, 190, 196];
const CONC_LIT = [226, 226, 230];
const CONC_DARK = [128, 128, 138];
const GRAVEL = [[150, 148, 144], [176, 170, 158], [124, 120, 116], [188, 168, 130], [160, 156, 150], [138, 130, 118]];
const GRAVEL_LIT = [220, 214, 200];
const GRAVEL_DARK = [84, 80, 76];
const BANNER_TEXT = [255, 255, 255]; // the unlock sign's lettering, whatever the palette
const WOOD_A = [176, 108, 50];
const WOOD_B = [160, 96, 44];
const WOOD_LIGHT = [214, 146, 76];
const WOOD_DARK = [96, 54, 22];
const { sky, ink, red, ground: groundCol, crack, fleck, kerb, grass, blade, shade, dirt, dirtLight, dirtDark, stone, stoneDark } = PAL;

// The ground, top to bottom: a thin surface strip the rider rolls on
// (asphalt, or a sidewalk in Stage 3), a thin grass layer, a chunky dirt
// layer, then plain black.
// The ball pit's colours (see obstacles/playground.js), for the balls it throws.
const BALL_COLORS = [[255, 85, 85], [255, 255, 85], [85, 85, 255], [85, 200, 85], [255, 150, 40], [190, 90, 230], [255, 140, 200], [90, 220, 230]];
const ASPHALT_H = 4;
const GRASS_H = 3;
const DIRT_H = 12;

// Cheap deterministic hash of a world pixel, so the asphalt texture is the same
// every frame and scrolls with the stage instead of shimmering.
const hash = (x, y) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

// Stage 3's skyline: a repeating row of buildings per layer, drawn faint
// behind everything and scrolled at a fraction of the camera (parallax).
// Widths and heights come from the same hash, so every tile is the same.
function makeSkyline(seed, count, minW, maxW, minH, maxH) {
  const list = [];
  let x = 0;
  for (let i = 0; i < count; i++) {
    const h = hash(i, seed);
    const w = minW + (h % (maxW - minW + 1));
    const hgt = minH + (hash(seed, i * 3 + 1) % (maxH - minH + 1));
    list.push({ x, w, h: hgt, antenna: hash(i, seed + 9) % 5 === 0, roof: hash(i, seed + 5) % 4 === 0 });
    x += w + (hash(i, seed + 2) % 4);
  }
  return { list, width: x };
}
const SKY_FAR = makeSkyline(11, 18, 12, 26, 28, 70);
const SKY_NEAR = makeSkyline(23, 14, 16, 30, 18, 50);
// The Mega Ramp's moon: a jagged ridge of far mountains per layer (a column height for
// every pixel of one repeating tile), and the moon's own palette.
function makeRidge(seed, width, minH, maxH) {
  const hs = new Array(width).fill(minH);
  let x = 0;
  while (x < width) {
    const run = 10 + (hash(x, seed) % 22); // a slope, up or down, a few px per column
    const to = minH + (hash(seed, x + 3) % (maxH - minH + 1));
    const from = hs[Math.max(0, x - 1)];
    for (let i = 0; i < run && x + i < width; i++) hs[x + i] = Math.round(from + ((to - from) * (i + 1)) / run);
    x += run;
  }
  // wrap: blend the last columns back to the first so the tile repeats
  for (let i = 0; i < 16; i++) hs[width - 1 - i] = Math.round(hs[width - 1 - i] * (i / 16) + hs[0] * (1 - i / 16));
  return hs;
}
const RIDGE_FAR = makeRidge(5, 300, 14, 58);
const RIDGE_NEAR = makeRidge(9, 260, 6, 30);
const MOON = {
  sky: [16, 24, 88],
  surface: [158, 158, 168], surfaceLit: [206, 206, 216], surfaceDark: [96, 96, 108],
  rock: [118, 118, 130], rockLight: [140, 140, 152], rockDark: [88, 88, 100],
  stone: [176, 176, 186], stoneDark: [70, 70, 82],
  craterIn: [64, 64, 78], craterDeep: [48, 48, 62], rimLit: [170, 170, 182],
};
// Hellride: the sky's bands (top to horizon), the black mountains, and the rival's look.
const HELL_BANDS = [[120, 16, 36], [158, 26, 40], [190, 42, 40], [222, 74, 42], [244, 120, 52], [252, 170, 70]];
// the far wall of fire along the horizon: deep red body, hotter core, lighter tip (all brighter than the rider is dark)
const HELL_FIRE = [[196, 46, 36], [226, 84, 40], [250, 140, 58]];
const HELL_SUN = [[255, 214, 120], [255, 170, 70]];
const RIVAL_LOOK = { color: [238, 232, 214], horns: [214, 30, 30] };
const RIVAL_DECK = [140, 10, 24];
const EMBER = [[255, 236, 120], [255, 170, 40], [255, 110, 20]];
const LAVA_BALLS = [[255, 236, 120], [255, 170, 40], [255, 110, 20], [214, 56, 14]];
const SPECIAL_LIFE = 1.3; // seconds a special's banner lives
const pad = (n, len = 6) => String(Math.max(0, n)).padStart(len, '0');

export class Renderer {
  constructor(pix) {
    this.g = pix;
    this.reset();
  }

  // `keepPose`: the rider rolled on from the last screen, so don't snap his pose.
  reset(keepPose = false) {
    if (!keepPose || !this.pose) this.pose = new PoseBlender('idle');
    this.rivalPose = new PoseBlender('idle');
    this.turbo = 0; // seconds left of the turbo flash and its trail
    this.particles = [];
    // Pop-up text lives in one fixed slot under the HUD, and a new message
    // replaces the old one instead of piling on top of it. Trick names show in
    // the HUD's combo line; the slot is for the points, banked on landing,
    // when the rider is down on the ground and out of the way.
    this.popups = { bank: null };
    this.specials = []; // banners for gaps and big tricks: { text, kind, age }
    this.squash = 0;
    this.pulse = 0; // the combo readout swells for a moment when a trick is added
    this.buttons = [];
    this.time = 0;
  }

  // Turn game events into visual effects.
  consume(events, game) {
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
        case 'manual':
          this.popup('bank', e.key === 'nose' ? 'NOSE MANUAL' : 'MANUAL');
          break;
        case 'bank':
          // big, and bigger for a bigger combo
          this.popup('bank', `+${e.total}`, { scale: e.mult >= 3 ? 3 : 2, sub: e.mult > 1 ? `${e.mult}X COMBO` : null });
          break;
        case 'trick':
          this.pulse = 0.25;
          break;
        case 'boost':
          this.turbo = 0.9;
          this.embers(e.x, e.y, 14);
          break;
        case 'special':
          this.specials.push({ text: `${e.name} +${e.points}`, kind: e.kind, age: 0 });
          if (this.specials.length > 3) this.specials.shift();
          break;
        case 'bail': {
          const pool = (e.reason === 'gap' || e.reason === 'rolled') && game?.level.obstacles.find((o) => o.splash && e.x >= o.splash.x1 - 20 && e.x <= o.splash.x2 + 20);
          if (pool && (e.reason === 'gap' || pool.splash.kind === 'lava')) this.splash(e.x, pool.splash.y, pool.splash.kind);
          else this.dust(e.x, e.y, 10);
          break;
        }
      }
    }
  }

  // Water, or coloured balls, flung up where the rider fell in.
  splash(x, y, kind = 'water') {
    const balls = kind === 'balls' || kind === 'lava'; // flung blobs: coloured balls, or glowing lava
    const colors = kind === 'lava' ? LAVA_BALLS : BALL_COLORS;
    for (let i = 0; i < (balls ? 22 : 28); i++) {
      this.particles.push({
        kind: balls ? 'ball' : 'splash',
        color: balls ? colors[i % colors.length] : null,
        x: x + (Math.random() - 0.5) * (balls ? 70 : 50),
        y: y - 2,
        vx: (Math.random() - 0.5) * (balls ? 260 : 200),
        vy: (balls ? -220 : -150) - Math.random() * 300,
        life: balls ? 1.1 : 0.7,
      });
    }
  }

  // Turbo sparks: bright embers thrown back behind the rider.
  embers(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({ kind: 'ember', x: x - 10 - Math.random() * 20, y: y - 8 - Math.random() * 24, vx: -120 - Math.random() * 220, vy: -80 + Math.random() * 120, life: 0.45 + Math.random() * 0.3, c: i % 3 });
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

  // opts: scale (text size, default 1) and sub (a smaller line under it)
  popup(slot, text, opts = {}) {
    this.popups[slot] = { text, life: opts.scale > 1 ? 1.5 : 1.1, scale: opts.scale || 1, sub: opts.sub || null };
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
    this.cam = cam; // main.js extends the ground past the game's edges from here
    g.ox = -cam.x;
    g.oy = -cam.y;
    this.drawSkyline(g, game, cam);
    this.drawBackground(game, cam);
    for (const o of game.level.obstacles) o.draw(g, { time: this.time, tilt: game.tilt, boom: game.boomAt === null ? null : game.time - game.boomAt, dump: game.dumpAt === null ? null : game.time - game.dumpAt });
    if (game.rival) this.drawSkater(game.rival.game, g, true, 'rival'); // behind the player
    this.drawSkater(game);
    this.drawParticles();
    g.ox = 0;
    g.oy = 0;
    const inset = Math.ceil(opts.inset || 0);
    this.drawPopups(inset);
    this.drawSpecials(inset);
    this.drawHud(game, opts, inset);
    this.drawOverlay(game, opts);
    g.flush();
  }

  step(game, dt) {
    this.squash = Math.max(0, this.squash - dt);
    if (this.turbo > 0) {
      this.turbo = Math.max(0, this.turbo - dt);
      if (game.phase === 'playing' && Math.random() < 0.7) this.embers(game.sk.x, game.sk.y, 1);
    }
    this.pulse = Math.max(0, this.pulse - dt);
    if (game.sk.mode === 'grind' && Math.random() < 0.6) this.sparks(game.sk.x, game.sk.y, 1);
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.kind === 'spark' ? 1400 : p.kind === 'ball' ? 900 : p.kind === 'ember' ? 0 : 300) * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const sp of this.specials) sp.age += dt;
    this.specials = this.specials.filter((sp) => sp.age < SPECIAL_LIFE);
    for (const k of Object.keys(this.popups)) {
      const p = this.popups[k];
      if (p && (p.life -= dt) <= 0) this.popups[k] = null;
    }
    // Bails and the level-end box use the middle of the screen: clear the way.
    if (game.phase !== 'playing') {
      this.popups = { bank: null };
      this.specials = [];
    }
  }

  // Camera position in pixels. Fixed-screen levels never move it.
  camera(game) {
    if (game.width <= WORLD.W) return { x: 0, y: 0 };
    const s = game.sk;
    const fx = s.mode === 'bail' && s.bail ? s.bail.x : s.x;
    const fy = s.mode === 'bail' && s.bail ? s.bail.y : s.y;
    // Look ahead the way the rider is going (back to the left after a quarter pipe).
    // The rider is drawn snapped to a whole pixel (see snap), and so is the lead,
    // so the rider holds the same spot on screen while the stage pans past.
    const lead = Math.round((s.dir < 0 ? (WORLD.W * 2) / 3 : WORLD.W / 3) / S);
    const x = Math.max(0, Math.min(Math.round((game.width - WORLD.W) / S), Math.round(fx / S) - lead));
    const y = Math.min(0, fy - (game.level.camTop ?? 330));
    return { x, y: Math.round(y / S) };
  }

  // The scene without the HUD (ground, obstacles and the rider) into another
  // framebuffer: main.js uses it to fill the bars around the game, so
  // whatever runs off the edge of the game (a rail, a ramp) carries on there,
  // and the rider stays in view all the way to the edge of a wide phone.
  drawScene(g, game, cam) {
    g.clear(sky);
    g.ox = -cam.x;
    g.oy = -cam.y;
    this.drawSkyline(g, game, cam);
    this.drawBackground(game, cam, g);
    for (const o of game.level.obstacles) o.draw(g, { time: this.time, tilt: game.tilt, boom: game.boomAt === null ? null : game.time - game.boomAt, dump: game.dumpAt === null ? null : game.time - game.dumpAt });
    if (game.rival) this.drawSkater(game.rival.game, g, false, 'rival');
    this.drawSkater(game, g, false); // same pose as this frame's game picture
    g.ox = 0;
    g.oy = 0;
  }

  // Stage 3: two faint building layers, slower than the stage. Drawn in screen
  // space, standing on the horizon (it moves with the camera's height).
  drawSkyline(g, game, cam) {
    if (game.level.clouds) this.drawClouds(g, cam);
    if (!game.level.skyline && !game.level.moon && !game.level.hell) return;
    const [ox, oy] = [g.ox, g.oy];
    g.oy = -cam.y;
    const horizon = P(WORLD.GROUND);
    if (game.level.hell) {
      g.oy = -Math.round((cam.py ?? cam.y) * 0.3) + (cam.top || 0);
      this.drawHellSky(g, cam, horizon);
      g.ox = ox;
      g.oy = oy;
      return;
    }
    if (game.level.moon) {
      // the sky behind the Mega Ramp moves only a little with the camera's height, so it stays in view up on the decks
      // (cam.py is the true camera; `top` lifts the bars' bigger frame so the sky lines up with the game picture instead of repeating it)
      g.oy = -Math.round((cam.py ?? cam.y) * 0.3) + (cam.top || 0);
      this.drawMoonSky(g, cam, horizon);
      g.ox = ox;
      g.oy = oy;
      return;
    }
    for (const [sky2, factor, colour, windows] of [[SKY_FAR, 0.12, PAL.far, false], [SKY_NEAR, 0.28, PAL.near, true]]) {
      // The bars around the game draw this scene again from a wider frame: `px`
      // is the true camera, `left` how far that frame reaches left of the game,
      // so the layers line up with the game picture instead of jumping at its edge.
      const shift = Math.round((cam.px ?? cam.x) * factor) - (cam.left || 0);
      const T = sky2.width;
      for (let tile = Math.floor(shift / T) - 1; tile * T - shift < g.w + 40; tile++) {
        for (const b of sky2.list) {
          const bx = tile * T + b.x - shift;
          if (bx > g.w || bx + b.w < 0) continue;
          g.ox = 0;
          g.fill(bx, horizon - b.h, b.w, b.h + 60, colour); // down past the horizon: ground covers it
          if (b.roof) g.fill(bx + 2, horizon - b.h - 2, b.w - 4, 2, colour);
          if (b.antenna) g.line(bx + (b.w >> 1), horizon - b.h - 7, bx + (b.w >> 1), horizon - b.h, colour);
          if (windows) {
            for (let wy = horizon - b.h + 3; wy < horizon - 3; wy += 5) {
              for (let wx = bx + 2; wx < bx + b.w - 2; wx += 4) if (hash(wx - bx + b.x, wy) % 3 === 0) g.pset(wx, wy, PAL.window);
            }
          }
        }
      }
    }
    g.ox = ox;
    g.oy = oy;
  }

  // Hellride's sky: bands of red deepening to blood orange at the horizon, a huge low sun sinking into the
  // horizon, and drifting embers. No mountains: the plain bands keep the dark rider easy to see.
  drawHellSky(g, cam, horizon) {
    const shiftOf = (factor) => Math.round((cam.px ?? cam.x) * factor) - (cam.left || 0);
    g.ox = 0;
    // bands: the last (brightest) one rests on the horizon, the rest stack above it; the top one goes on up
    const bandH = [22, 24, 20, 18, 16, 12];
    let y = horizon;
    for (let i = HELL_BANDS.length - 1; i >= 0; i--) {
      const h = i === 0 ? 600 : bandH[i];
      g.fill(0, y - h, g.w, h, HELL_BANDS[i]);
      // a dithered edge to the band above, so it blends in chunky steps
      if (i > 0) for (let x = 0; x < g.w; x++) if ((x + i) % 2 === 0) g.pset(x, y - h, HELL_BANDS[i]);
      y -= h;
    }
    // the bright band carries on down past the horizon (the sky shifts a little against the ground as the camera rises)
    g.fill(0, horizon, g.w, 160, HELL_BANDS[HELL_BANDS.length - 1]);
    // the sun: a big disc, half sunk below the horizon
    const sx = 236 - shiftOf(0.015);
    const sr = 26;
    for (let dy = -sr; dy <= sr; dy++) {
      const half = Math.round(Math.sqrt(sr * sr - dy * dy));
      g.fill(sx - half, horizon - 4 + dy, half * 2 + 1, 1, HELL_SUN[dy < 4 ? 0 : 1]);
    }
    // a far wall of fire: two rows of slow, flickering tongues of flame standing on the horizon (the
    // back row taller, dimmer and slower), in reds close to the bands so they glow without competing
    // with the rider
    const fireT = this.time;
    for (const [factor, cell, minH, rangeH, body, core, speed, salt] of [
      [0.03, 17, 16, 24, [178, 34, 40], [206, 58, 40], 0.7, 77],
      [0.06, 11, 8, 18, HELL_FIRE[0], HELL_FIRE[1], 1, 91],
    ]) {
      const fsh = shiftOf(factor);
      for (let x = 0; x < g.w; x++) {
        const wx = x + fsh;
        const c = Math.floor(wx / cell);
        const hh = hash(c, salt);
        if (hh % 10 < 2) continue; // gaps between the flames
        const u = wx - c * cell - cell / 2; // across the tongue, centred
        const phase = (hh >> 4) % 100;
        const flick = Math.round((Math.sin(fireT * 2.4 * speed + phase) * 3 + Math.sin(fireT * 5.1 * speed + phase * 2) * 1.2) * (cell / 11));
        const top = minH + ((hh >> 9) % rangeH) + flick; // flame height
        const sway = Math.sin(fireT * 1.7 * speed + phase) * (cell / 7);
        const lean = Math.abs(u - sway * 0.5);
        const ht = Math.round(top * Math.pow(Math.max(0, 1 - lean / (cell * 0.5)), 1.3));
        if (ht <= 0) continue;
        g.fill(x, horizon - ht, 1, ht + 40, body);
        const inner = Math.round(ht * 0.62);
        if (inner > 2 && lean < cell * 0.3) g.fill(x, horizon - inner, 1, inner, core);
        if (salt === 91 && ht > 14 && lean < 1.2) g.pset(x, horizon - ht + 1, HELL_FIRE[2]);
      }
    }
    // embers drifting up (and across): 26 per 700-pixel tile of sky, which scrolls slower than the stage
    const t = this.time;
    const esh = shiftOf(0.2);
    for (let i = 0; i < 26; i++) {
      const h = hash(i, 41);
      const u = ((((h % 700) - Math.round(t * (6 + (h % 9)))) % 700) + 700) % 700;
      const yy = horizon - 6 - ((((h >> 8) % 400) + Math.round(t * (10 + (h % 14)))) % 150);
      for (let tile = Math.floor(esh / 700) - 1; tile * 700 + u - esh < g.w + 2; tile++) {
        const x = tile * 700 + u - esh;
        if (x < -2) continue;
        g.pset(x, yy, EMBER[h % 3]);
        if (h % 5 === 0) g.pset(x + 1, yy, EMBER[1]);
      }
    }
  }

  // The Mega Ramp's sky: navy, white stars that barely drift, a pixel Earth, and two
  // layers of far grey mountains standing on the horizon.
  drawMoonSky(g, cam, horizon) {
    const shiftOf = (factor) => Math.round((cam.px ?? cam.x) * factor) - (cam.left || 0);
    g.ox = 0;
    // stars: one possible star per 14 px cell, most a single white pixel, some bigger or dim
    const CELL = 14;
    const sh = shiftOf(0.03);
    const y0 = Math.floor(-g.oy / CELL) - 1;
    for (let cy = y0; cy * CELL < -g.oy + g.h + CELL; cy++) {
      for (let cx = Math.floor(sh / CELL) - 1; cx * CELL - sh < g.w + CELL; cx++) {
        const h = hash(cx + 400, cy + 77);
        if (h % 3 !== 0) continue;
        const x = cx * CELL - sh + ((h >> 4) % CELL);
        const y = cy * CELL + ((h >> 9) % CELL);
        if (y > horizon - 4) continue;
        const kind = (h >> 14) % 12;
        if (kind === 0) {
          // a bright star: a plus shape
          g.fill(x - 1, y, 3, 1, [255, 255, 255]);
          g.fill(x, y - 1, 1, 3, [255, 255, 255]);
        } else if (kind < 4) g.pset(x, y, [150, 160, 220]); // dim
        else g.pset(x, y, [255, 255, 255]);
      }
    }
    // Earth, big and low in the sky, slow to drift: ocean, a bit of land, cloud, a shaded side
    const ex = 244 - shiftOf(0.01);
    const ey = horizon - 100;
    const R = 15;
    for (let dy = -R - 1; dy <= R + 1; dy++) {
      for (let dx = -R - 1; dx <= R + 1; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > (R + 1) * (R + 1)) continue;
        let c = [0, 0, 0];
        if (d2 <= R * R) {
          c = [44, 96, 214];
          const land = Math.sin(dx * 0.55 + 1) + Math.cos(dy * 0.6 - 0.5) + Math.sin((dx + dy) * 0.3);
          if (land > 1.1) c = [60, 160, 84]; // land
          if (hash((dx + 40) >> 1, (dy + 40) >> 1) % 7 === 0 && Math.abs(dy) < 11) c = [236, 242, 252]; // cloud flecks
          if (dx + dy > 14 || dx * 0.5 + dy * 0.9 > 13) c = c.map((v) => Math.round(v * 0.55)); // night side
          else if (dx + dy < -14) c = c.map((v) => Math.min(255, v + 36)); // lit rim
        }
        g.pset(ex + dx, ey + dy, c);
      }
    }
    // far mountains, then nearer ones: dark grey-blue, with a lit top edge
    for (const [ridge, factor, body, lit] of [[RIDGE_FAR, 0.06, [40, 44, 92], [66, 70, 124]], [RIDGE_NEAR, 0.16, [58, 60, 100], [92, 94, 136]]]) {
      const T = ridge.length;
      const s = shiftOf(factor);
      for (let x = 0; x < g.w; x++) {
        const h = ridge[(((x + s) % T) + T) % T];
        g.fill(x, horizon - h, 1, h + 60, body);
        g.fill(x, horizon - h, 1, 1, lit);
      }
    }
  }

  // Stages 1-2: chunky pale clouds in three layers, each drifting past slower than
  // the stage (the far ones barely move) and slowly blowing along by themselves.
  // Low contrast against the sky so the rider, rails and HUD stay readable.
  drawClouds(g, cam) {
    const [ox, oy] = [g.ox, g.oy];
    g.ox = 0;
    g.oy = -Math.round((cam.py ?? cam.y) * 0.15) + (cam.top || 0);
    const layers = [
      // factor, drift px/s, tile width, cloud count, base y, spread, scale, colour
      [0.04, 1.5, 260, 3, 18, 26, 0.6, [136, 195, 255]],
      [0.09, 2.5, 300, 3, 30, 40, 0.85, [160, 208, 255]],
      [0.16, 4, 360, 2, 46, 50, 1.2, [188, 224, 255]],
    ];
    for (const [factor, drift, T, count, base, spread, scale, colour] of layers) {
      const shift = Math.round((cam.px ?? cam.x) * factor + this.time * drift) - (cam.left || 0);
      for (let tile = Math.floor(shift / T) - 1; tile * T - shift < g.w + 60; tile++) {
        for (let i = 0; i < count; i++) {
          const h = hash(i * 31 + 7, Math.round(factor * 100));
          const cx = tile * T - shift + Math.round(((i + 0.2 + (h % 60) / 100) * T) / count);
          const cy = base + ((h >> 3) % spread);
          const w = Math.round((26 + (h % 24)) * scale);
          if (cx > g.w || cx + w < 0) continue;
          const u = Math.max(2, Math.round(3 * scale)); // one chunk
          g.fill(cx, cy, w, u * 2, colour); // flat base
          g.fill(cx + u, cy - u, w - 2 * u, u, colour);
          g.fill(cx + Math.round(w * 0.22), cy - 2 * u, Math.round(w * 0.3), u, colour); // puffs
          g.fill(cx + Math.round(w * 0.5), cy - Math.round(1.6 * u), Math.round(w * 0.24), Math.round(0.6 * u) + 1, colour);
        }
      }
    }
    g.ox = ox;
    g.oy = oy;
  }

  drawBackground(game, cam = { x: 0, y: 0 }, g = this.g) {
    const G = P(WORLD.GROUND);

    // ground: solid black, column by column so gaps, banks, ramps and stairs
    // all come from the level's ground segments
    const bottom = g.h + cam.y;
    // (a piece flagged `under`, like the fun box, sits on the flat street: its own
    // draw paints the shape, so the street column under it is the flat one)
    const topAt = (x) => {
      const gs = game.groundAt(x * S + S / 2);
      return Math.min(bottom, P(gs.under ? WORLD.GROUND : gs.y));
    };
    const patches = game.level.obstacles.filter((o) => o.dirt).map((o) => o.dirt);
    let top = topAt(cam.x);
    for (let x = cam.x; x < cam.x + g.w; x++) {
      const next = topAt(x + 1);
      if (top < bottom && game.level.moon) {
        this.drawMoon(g, x, top, next, bottom);
      } else if (top < bottom && ['concrete', 'wood'].includes(game.groundAt(x * S + S / 2).material)) {
        // a poured concrete slab (a bank, the Euro Gap) or a wooden ramp down to the street, then the street's own layers
        const base = Math.max(top, G);
        if (game.groundAt(x * S + S / 2).material === 'wood') this.drawWood(g, x, top, base);
        else this.drawConcrete(g, x, top, base);
        g.fill(x, base, 1, bottom - base, ink);
        this.drawGround(g, x, base, bottom, !!game.level.sidewalk);
      } else if (top < bottom) {
        g.fill(x, top, 1, bottom - top, ink);
        // raised ground (ramps, banks, stair platforms) is solid earth down to where the street's own dirt ends
        this.drawGround(g, x, top, bottom, !!game.level.sidewalk, ASPHALT_H, GRASS_H, G + ASPHALT_H + GRASS_H + DIRT_H);
      } else {
        // no ground here (a pit, pool, moat or chasm): plain black from the street down, so the sky never shows
        // through under the water, balls or lava and bleeds into the touch area below the level. The pit's own
        // drawing goes over this.
        if (top >= bottom) g.fill(x, Math.min(G, bottom), 1, bottom - Math.min(G, bottom), ink);
        // a dirt-filled gap: a strip sunk a little below the street, no asphalt or grass
        const wx = x * S + S / 2;
        if (patches.length && patches.some((p) => wx >= p.x1 && wx < p.x2)) {
          g.fill(x, G + 2, 1, bottom - G - 2, ink);
          const kind = patches.find((p) => wx >= p.x1 && wx < p.x2)?.kind;
          if (kind === 'gravel') this.drawGravel(g, x, G + 2, Math.min(bottom, G + DIRT_H + GRASS_H + ASPHALT_H));
          else if (kind === 'rubble') this.drawRubble(g, x, G + 2, Math.min(bottom, G + DIRT_H + GRASS_H + ASPHALT_H));
          else this.drawGround(g, x, G + 2, bottom, false, 0, 0);
        }
      }
      top = next;
    }
  }

  // A poured concrete column from `top` down to `base`: a lit top edge, the odd
  // crack and speckle, a slab joint every 28 px (like the Big Set).
  drawConcrete(g, x, top, base) {
    for (let y = top; y < base; y++) {
      const d = y - top;
      let c = CONC;
      if (d < 2) c = CONC_LIT;
      else if (d > 3 && (x * 7 + y * 13) % 61 === 0) c = CONC_DARK;
      else if ((x * 3 + y * 5) % 19 === 0) c = CONC_LIT;
      else if (x % 28 === 0) c = CONC_DARK;
      g.pset(x, y, c);
    }
    g.pset(x, top - 1, ink); // outline along the top edge
  }

  // Loose gravel: chunky 2x2 stones in greys and tans, speckled, dark in the gaps.
  drawGravel(g, x, top, end) {
    for (let y = top; y < end; y++) {
      const hb = hash(x >> 1, y >> 1) % 12;
      let c = GRAVEL[hb % GRAVEL.length];
      if (hash(x, y) % 9 === 0) c = hb % 2 ? GRAVEL_DARK : GRAVEL_LIT; // speckle
      if (y === top) c = GRAVEL_DARK;
      g.pset(x, y, c);
    }
  }

  // Broken concrete and dirt: chunky 3x3 pieces of slab in greys, with brown dirt
  // and the odd rust-coloured bit of rebar showing between them.
  drawRubble(g, x, top, end) {
    for (let y = top; y < end; y++) {
      const hb = hash(Math.floor(x / 3), Math.floor((y + (Math.floor(x / 3) % 2)) / 3)) % 13;
      let c;
      if (hb < 6) c = CONC;
      else if (hb < 8) c = CONC_LIT;
      else if (hb < 10) c = CONC_DARK;
      else if (hb < 12) c = dirtDark;
      else c = [150, 80, 40]; // rust
      if (hash(x, y) % 7 === 0) c = hb % 2 ? CONC_DARK : dirt; // speckle
      if (x % 3 === 2 || y % 3 === 2) c = hb < 10 ? CONC_DARK : dirtDark; // the cracks between pieces
      if (y === top) c = [84, 80, 76];
      g.pset(x, y, c);
    }
  }

  // The Mega Ramp's ground, ramps and quarter pipe alike: grey moon rock. A thin
  // pale surface strip the rider rolls on, then chunky regolith in 2x2 blocks of grey
  // (with the odd stone and round craters, lit on their upper-left rim), down to where
  // the street's own layers end, then plain black. A black outline runs along the top.
  // `next` is the next column's top, so steep ramps get an unbroken outline.
  drawMoon(g, x, top, next, bottom) {
    const G = P(WORLD.GROUND);
    const end = Math.min(bottom, Math.max(top, G) + ASPHALT_H + GRASS_H + DIRT_H);
    g.fill(x, Math.min(top, next) - 1, 1, Math.abs(top - next) + 1, ink);
    g.fill(x, top, 1, bottom - top, ink);
    for (let y = top; y < end; y++) {
      const hb = hash(x >> 1, y >> 1) % 16; // one value per 2x2 block
      let c;
      if (y < top + 4) {
        c = hb < 3 ? MOON.surfaceLit : hb < 5 ? MOON.surfaceDark : MOON.surface;
        if (y === top) c = MOON.surfaceLit;
        else if (y === top + 3) c = MOON.surfaceDark;
      } else {
        c = hb < 4 ? MOON.rockLight : hb < 6 ? MOON.rockDark : MOON.rock;
        if (hash((x >> 1) + 5, (y >> 1) + 9) % 53 === 0) c = (x & 1) === 0 && (y & 1) === 0 ? MOON.stone : MOON.stoneDark;
        c = this.craterColour(x, y - G, c);
      }
      g.pset(x, y, c);
    }
  }

  // A round crater in the rock: cells of 40x24 px, a third of them with one crater
  // (dark inside, a lit rim up and left, a dark one down and right). The row of cells
  // under the street's surface is fixed so its craters fit in the strip.
  craterColour(x, y, c) {
    const cx = Math.floor(x / 40);
    const cy = Math.floor(y / 24);
    const h = hash(cx + 91, cy + 17);
    if (h % 3 !== 0) return c;
    const rx = 6 + ((h >> 5) % 6);
    const ry = Math.max(2, Math.round(rx * 0.4));
    const px = cx * 40 + rx + 2 + ((h >> 9) % (40 - 2 * rx - 4));
    const py = cy * 24 + (cy === 0 ? 11 : ry + 2 + ((h >> 13) % (24 - 2 * ry - 4)));
    const dx = (x - px) / rx;
    const dy = (y - py) / ry;
    const d2 = dx * dx + dy * dy;
    if (d2 <= 0.7) return dy > -0.2 ? MOON.craterIn : MOON.craterDeep;
    if (d2 <= 1) return dx + dy < 0 ? MOON.rimLit : MOON.rockDark;
    return c;
  }

  // The Mega Ramp's ground: wooden planks all the way down (street, ramps and
  // quarter pipe alike). Boards are 6 px tall rows with a dark seam, butt joints
  // staggered per row, a lit top edge, and the odd bit of grain.
  drawWood(g, x, top, bottom) {
    for (let y = top; y < bottom; y++) {
      const row = Math.floor(y / 6);
      let c = row % 2 ? WOOD_A : WOOD_B;
      const hb = hash(x >> 1, y);
      if (hb % 11 === 0) c = WOOD_DARK;
      else if (hb % 13 === 0) c = WOOD_LIGHT;
      if ((x + row * 23) % 54 === 0) c = WOOD_DARK; // butt joint
      if (y % 6 === 5) c = WOOD_DARK; // seam under each board
      if (y === top) c = WOOD_LIGHT; // lit top edge
      g.pset(x, y, c);
    }
  }

  // One ground column. All textures are blocks two pixels square in a few
  // tones, hashed on the world pixel so they hold still and scroll with the
  // stage: the surface in greys with the odd speckle (a sidewalk also has
  // a dark joint every 28 px), the grass in greens, the dirt in muted browns
  // with the odd grey stone. Below that the ground is plain black.
  drawGround(g, x, top, bottom, sidewalk, asphalt = ASPHALT_H, grassH = GRASS_H, floor = 0) {
    const surfaceEnd = top + asphalt;
    const grassEnd = surfaceEnd + grassH;
    const dirtEnd = Math.max(grassEnd + DIRT_H, floor);
    const end = Math.min(bottom, dirtEnd);
    for (let y = top; y < end; y++) {
      const hb = hash(x >> 1, y >> 1) % 16; // one value per 2x2 block
      let c;
      if (y < surfaceEnd) {
        c = groundCol;
        if (hb < 3) c = kerb;
        else if (hb < 5) c = crack;
        else if (hb === 5 && hash(x, y) % 2 === 0) c = fleck;
        if (y === top) c = sidewalk ? crack : kerb; // top edge (a sidewalk's is darker, to show against the light sky)
        else if (y === surfaceEnd - 1) c = crack; // dark underside
        if (sidewalk && x % 28 === 0 && y > top) c = crack; // slab joint
      } else if (y < grassEnd) {
        c = y === surfaceEnd ? shade : hb < 6 ? blade : hb < 11 ? grass : shade;
      } else {
        const dy = y - grassEnd;
        c = hb < 4 ? dirtLight : hb < 6 ? dirtDark : dirt;
        if (dy === 0) c = dirtDark; // the shadow under the grass
        // a stone: a 2x2 block now and then, lit on its top-left pixel
        if (hash((x >> 1) + 5, (y >> 1) + 9) % 53 === 0) c = (x & 1) === 0 && (y & 1) === 0 ? stone : stoneDark;
      }
      g.pset(x, y, c);
    }
  }

  // `advance` false redraws this frame's pose without moving the animation on.
  // `who` 'rival' draws the rival's Game (a pale skeleton with horns on a dark red board).
  drawSkater(game, g = this.g, advance = true, who = null) {
    const s = game.sk;
    const dt = this.frameDt || 1 / 60;
    const look = who ? RIVAL_LOOK : {};
    const deck = who ? RIVAL_DECK : PAL.deck;
    const poseOf = who ? this.rivalPose : this.pose;
    const squash = who ? 0 : this.squash;

    if (s.mode === 'bail' && s.bail) {
      const b = s.bail;
      // the board tumbles end over end on its own
      drawBoard(g, makeTransform(snap(b.bx), b.by, b.bang), 0, 0, deck);
      // the ragdoll's joints are in world units: 3 world units to a pixel
      const r = b.rag;
      const pts = r.pts;
      const { sx, sy } = squashOf(r);
      let low = -Infinity;
      for (const k in pts) low = Math.max(low, pts[k].y);
      const px = pts.hip.x;
      // squash and stretch sit on the lowest joint, in three steps so it stays pixel art
      const tf = (p) => ({ x: (px + (p.x - px) * sx) / S, y: (low + (p.y - low) * sy) / S });
      const tilt = Math.atan2(pts.head.x - pts.neck.x, -(pts.head.y - pts.neck.y));
      drawFigure(g, tf, pts, { k: RAG_SIZE, face: r.dir, tilt, ...look });
      return;
    }

    let target = 'roll';
    if (game.phase === 'ready' || game.wait > 0) target = 'idle';
    else if (s.mode === 'grind') target = 'grind';
    else if (s.mode === 'air') target = s.flip ? 'flip' : s.primed ? 'prime' : 'air';
    else if (s.mode === 'ramp') target = 'crouch';
    else if (s.manual) target = 'prime';
    else if (s.charge) target = game.chargeLevel() > 0.5 ? 'charge' : 'crouch'; // crouch deeper the longer you hold
    else if (squash > 0) target = 'crouch';
    if (advance) poseOf.update(target, dt);

    // The board follows the ground (banks), tilts with the arc in the air,
    // and with the rail on a sloped grind. `face` is the way the skater faces:
    // after a quarter pipe they ride back out fakie, still facing right.
    const face = s.face;
    let pitch = s.mode === 'air' ? boardPitch(s.vy) * face : s.mode === 'roll' ? Math.atan(s.slope) : 0;
    if (s.manual) pitch += s.manual.type.pitch * face; // manual: nose up, nose manual: nose down
    if (s.mode === 'grind') {
      const r = s.grind.surface;
      if (r.y1 !== undefined || r.arc) pitch = Math.atan(slopeOf(r, s.x));
      pitch += s.grind.type.pitch * face; // 5-0 tips the nose up, nose grind tips it down
    } else if (s.mode === 'ramp') {
      pitch = -s.ramp.th; // standing on the curve
    } else if (s.qpAir) {
      pitch = -Math.PI / 2; // straight up and down, just as you left the wall
    }
    let base = makeTransform(snap(s.x), s.y, pitch);
    if (s.flip?.trick.body === 'backflip') {
      // Head over heels, backwards (counter-clockwise when riding right),
      // turning around the middle of the body.
      const p = game.flipProgress();
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
      const p = game.flipProgress();
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
    drawBoard(g, squashX(base, boardSx), spin, lift, deck);
    drawFigure(g, squashX(base, bodySx), poseOf.pose, look);
  }

  drawParticles() {
    for (const p of this.particles) {
      if (p.kind === 'ball') {
        this.g.fill(P(p.x), P(p.y), 2, 2, p.color); // a flung ball: a 2x2 block
        this.g.pset(P(p.x), P(p.y), PAL.wheel);
        continue;
      }
      if (p.kind === 'ember') {
        this.g.pset(P(p.x), P(p.y), EMBER[p.life < 0.2 ? 2 : p.c]);
        continue;
      }
      const c = p.kind === 'spark' ? red : p.kind === 'splash' ? [190, 225, 255] : ink;
      this.g.pset(P(p.x), P(p.y), c);
    }
  }

  // Specials: a solid plate with a bold outline behind the text, which pops in,
  // drifts up and dithers away over SPECIAL_LIFE seconds. Newest at the bottom,
  // older ones above it. Kept right of centre, clear of the rider.
  drawSpecials(inset = 0) {
    const g = this.g;
    const cx = Math.round(RES.W * 0.74);
    const n = this.specials.length;
    this.specials.forEach((sp, i) => {
      const t = sp.age;
      const text = fit(g, sp.text, RES.W - 2 * inset - 24);
      const w = g.textWidth(text) + 10;
      const h = 15;
      const rise = Math.round(Math.min(1, t / SPECIAL_LIFE) * 12);
      const pop = t < 0.12 ? Math.round((1 - t / 0.12) * 6) : 0; // slides up into place
      const y = 56 + (n - 1 - i) * (h + 3) - rise + pop;
      const x = Math.min(Math.round(cx - w / 2), RES.W - inset - 4 - w);
      const [fill, edge, ink2] = sp.kind === 'gap' ? [[255, 200, 40], [150, 70, 0], [90, 30, 0]] : [[210, 30, 50], [100, 0, 20], [255, 255, 255]];
      // dither out: more of the plate drops away as it fades
      const level = t < 0.85 ? 0 : t < 1.05 ? 1 : 2;
      const keep = (px, py) => level === 0 || (level === 1 ? (px + py) % 2 === 0 : (px + py) % 4 === 0 && py % 2 === 0);
      for (let py = y; py < y + h; py++) {
        for (let px = x; px < x + w; px++) {
          const border = px === x || px === x + w - 1 || py === y || py === y + h - 1;
          const shade = !border && py >= y + h - 3;
          if (keep(px, py)) g.pset(px, py, border ? ink : shade ? edge : fill);
        }
      }
      if (t < 1.05) g.text(text, x + 5, y + 4, ink2, 1);
    });
  }

  // Centred under the HUD (which ends about y 33).
  drawPopups(inset = 0) {
    const g = this.g;
    const room = RES.W - 2 * inset - 8;
    const p = this.popups.bank;
    if (!p || (p.life < 0.3 && Math.floor(p.life * 20) % 2)) return; // blink out
    let sc = p.scale;
    while (sc > 1 && g.textWidth(p.text, sc) > room) sc--;
    const y = sc > 1 ? 34 : 42;
    if (sc > 1) g.text(p.text, RES.W / 2 + 1, y + 1, ink, sc, 'center'); // a drop shadow so it reads on any sky
    g.text(fit(g, p.text, room), RES.W / 2, y, red, sc, 'center');
    if (p.sub) {
      g.text(p.sub, RES.W / 2 + 1, y + sc * 7 + 4, ink, 1, 'center');
      g.text(p.sub, RES.W / 2, y + sc * 7 + 3, red, 1, 'center');
    }
  }

  // `inset` is how many pixels at each side are cropped off (zoomed portrait view).
  drawHud(game, opts, inset = 0) {
    const g = this.g;
    const L = 4 + inset;
    const R = RES.W - 4 - inset;
    // A stage's sections are numbered after it: 1-3 is stage 1's third.
    const sec = game.sections.length > 1 ? `-${game.section + 1}` : '';
    const title = `${game.levelLabel || `LEVEL ${game.levelNumber || 1}`}${sec}: ${game.sectionName}`;
    g.text(title, L, 4, red);
    // With 2+ stages open, the title doubles as the stage list button on the
    // start and bail screens: a thin underline hints at it.
    this.titleBox = null;
    if (opts.stagesButton && !opts.screen && (game.phase === 'ready' || game.phase === 'bailed')) {
      const w = g.textWidth(title);
      g.fill(L, 12, w, 1, red);
      this.titleBox = { x: L - 2, y: 2, w: w + 4, h: 12 };
    }
    // Top right: just the running total for the run, with the speed under it.
    // Tricks and combos pop up on screen; high scores wait for the end.
    const total = opts.total ?? game.score;
    g.text(`TOTAL ${pad(total)}`, R, 4, red, 1, 'right');
    if (game.phase === 'playing') this.drawSpeed(game, R, 15);
    if (game.rival) this.drawRace(game, L, R);
    // After a retry the rider stands ready for a moment before rolling off.
    if (game.phase === 'playing' && game.wait > 0) {
      const cx = RES.W / 2;
      g.text('READY', cx + 1, 63, ink, 2, 'center');
      g.text('READY', cx, 62, red, 2, 'center');
    }
    // A manual in progress counts as a trick in the combo already (it joins it for good when it ends).
    const m = game.sk.manual;
    const live = m ? [{ name: m.type.name, points: m.type.base + Math.round(m.pts), base: 0, weight: manualWeight(m.t) }] : [];
    const tricks = [...game.combo, ...live];
    if (tricks.length && game.phase === 'playing') {
      // Under the level name, kept clear of the right-hand column: the oldest
      // tricks drop off the front when the list gets too long.
      const room = R - L - Math.max(g.textWidth(`TOTAL ${pad(total)}`), 75) - 8;
      // a repeated trick shows what it is worth now (e.g. KICKFLIP 75)
      const names = tricks.map((t) => (t.points < t.base ? `${t.name} ${t.points}` : t.name));
      let text = names.join(' + ');
      for (let i = 1; i < names.length && g.textWidth(text) > room; i++) text = `...${names.slice(i).join(' + ')}`;
      g.text(fit(g, text, room), L, 15, red);
      // The running combo value, big: it swells as each trick is added.
      const mult = comboMult(tricks);
      const comboTotal = tricks.reduce((a, t) => a + t.points, 0) * mult;
      const sc = this.pulse > 0 ? 3 : 2;
      const readout = `+${comboTotal}${mult > 1 ? ` ${mult}X` : ''}`;
      g.text(readout, L + 1, 25, ink, sc);
      g.text(readout, L, 24, red, sc);
    }
  }

  // The race: a track along the bottom of the screen (the black below the ground) from the start to the
  // finish flag with a marker for you and one for the rival, a "RIVAL >>" arrow when it is off the
  // right edge of the screen, and "<< RIVAL" when it is behind the left edge.
  drawRace(game, L, R) {
    const g = this.g;
    const { finishX } = game.level.race;
    const x0 = game.sections[0].x + PHYS.START_X;
    const frac = (x) => Math.max(0, Math.min(1, (x - x0) / (finishX - x0)));
    const y = RES.H - 6;
    g.fill(0, RES.H - 12, RES.W, 12, ink); // a black strip behind the bar, whatever the camera shows below the ground
    const CREAM = [255, 240, 200];
    const RED = [230, 50, 50];
    // legend
    g.fill(L, y - 2, 5, 5, CREAM);
    g.text('YOU', L + 8, y - 3, CREAM);
    g.fill(L + 34, y - 2, 5, 5, RED);
    g.text('RIVAL', L + 42, y - 3, RED);
    // the track
    const tx0 = L + 82;
    const tx1 = R - 10;
    g.fill(tx0, y, tx1 - tx0 + 1, 1, [150, 150, 150]);
    for (let i = 0; i <= 8; i++) g.pset(tx0 + Math.round(((tx1 - tx0) * i) / 8), y - 1, [110, 110, 110]);
    // finish flag: a small chequered square
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) g.pset(tx1 + 1 + i, y - 4 + j, (i + j) % 2 ? [250, 250, 250] : ink);
    const mark = (x, c, dy) => g.fill(Math.round(tx0 + (tx1 - tx0) * frac(x)) - 2, y - 2 + dy, 5, 5, c);
    const rx = game.rival.x;
    mark(rx, RED, 0);
    mark(game.sk.mode === 'bail' && game.sk.bail ? game.sk.bail.x : game.sk.x, CREAM, 0);
    // off-screen arrows
    const cam = this.cam || { x: 0 };
    const sx = P(rx) - cam.x;
    if (game.phase === 'playing' && sx > RES.W + 2) g.text('RIVAL >>', R, 118, red, 1, 'right');
    else if (game.phase === 'playing' && sx < -6) g.text('<< RIVAL', L, 118, red, 1, 'left');
  }

  // SPEED and a bar of cells, right-aligned to `right`: the middle cell is cruising speed.
  drawSpeed(game, right, y) {
    const g = this.g;
    const cells = 10;
    const lo = game.cruise * PHYS.SPEED_MIN;
    const hi = game.cruise * (game.sk.manual ? PHYS.MANUAL_SPEED_MAX : PHYS.SPEED_MAX); // a manual's climb has its own top
    const n = Math.max(1, Math.min(cells, Math.round(1 + ((cells - 1) * (game.speed - lo)) / (hi - lo))));
    const bx = right - cells * 4 + 1;
    if (this.turbo > 0 && this.blink(5)) g.text('TURBO', bx - 4, y, [255, 150, 20], 1, 'right');
    else g.text('SPEED', bx - 4, y, red, 1, 'right');
    for (let i = 0; i < cells; i++) {
      if (i < n) g.fill(bx + i * 4, y, 3, 7, red);
      else g.rect(bx + i * 4, y, 3, 7, red);
    }
  }

  blink(rate = 3) {
    return Math.floor(this.time * rate * 2) % 2 === 0;
  }

  drawOverlay(game, opts = {}) {
    const g = this.g;
    this.buttons = [];
    const cx = RES.W / 2;

    if (opts.screen?.type === 'entry') return this.drawEntry(opts.screen);
    this.gameCenter = !!opts.gameCenter;
    if (opts.screen?.type === 'scores') return this.drawScores(opts.screen, opts.highScores || []);
    if (opts.screen?.type === 'unlock') return this.drawUnlock(opts.screen);
    if (opts.screen?.type === 'select') return this.drawSelect(opts.screen);

    const tb = this.titleBox;
    if (tb) this.buttons.push({ id: 'stages', x: tb.x * S, y: tb.y * S, w: tb.w * S, h: tb.h * S });

    if (game.phase === 'ready') {
      // Arcade attract mode: on the first level, the title takes turns with the high scores.
      const showTable = opts.attract && opts.highScores?.length && Math.floor(this.time / 4) % 2 === 1;
      // Rows sit clear of the rider's head and of level 3's handrail.
      let tapY;
      if (showTable) {
        g.text('HIGH SCORES', cx + 1, 39, ink, 2, 'center');
        g.text('HIGH SCORES', cx, 38, red, 2, 'center');
        this.drawTable(opts.highScores, 62, -1, 11);
        tapY = 124;
      } else {
        const title = game.rival ? 'HELLRIDE' : 'STICKFLIP';
        g.text(title, cx + 1, 39, ink, 4, 'center');
        g.text(title, cx, 38, red, 4, 'center');
        if (game.rival) g.text('FIRST TO THE FINISH WINS', cx, 70, red, 1, 'center');
        tapY = 80; // no control tips: players find the controls themselves
      }
      if (this.blink()) g.text('TAP TO START', cx, tapY, red, 1, 'center');
    } else if (game.phase === 'beaten') {
      // the rival crossed the line first
      g.text('RIVAL WINS!', cx + 1, 39, ink, 3, 'center');
      g.text('RIVAL WINS!', cx, 38, red, 3, 'center');
      g.text('SUCKS TO SUCK', cx, 64, red, 1, 'center');
      const spot = loserSpot(cx);
      drawSticker(g, spot.x, spot.y, 'LOSER', spot.opts);
      if (game.phaseTime >= PHYS.BAIL_RETRY_DELAY && this.blink()) g.text('TAP TO RACE AGAIN', cx, 82, red, 1, 'center');
    } else if (game.phase === 'bailed') {
      g.text('BAIL!', cx + 1, 39, ink, 3, 'center');
      g.text('BAIL!', cx, 38, red, 3, 'center');
      g.text('SUCKS TO SUCK', cx, 64, red, 1, 'center');
      // a sticker stuck on the end of the sentence
      const spot = loserSpot(cx);
      drawSticker(g, spot.x, spot.y, 'LOSER', spot.opts);
      const ready = game.phaseTime >= PHYS.BAIL_RETRY_DELAY;
      if (ready && this.blink()) g.text('TAP TO TRY AGAIN', cx, 82, red, 1, 'center');
      // Past the first checkpoint, the whole stage can be started over.
      if (ready && game.checkpoint.index > 0) this.button('restart', 'RESTART STAGE', cx - 45, 96, 90, true);
    }
  }

  // The secret level's arrival: a blinking banner over the scene.
  drawUnlock(screen) {
    const g = this.g;
    const cx = RES.W / 2;
    const [x, y, w, h] = [20, 48, 280, 70];
    // a moon-base sign: a panel of grey rock plating with a black outline and rivets, over a
    // navy screen with a few stars, lettering in white and pale blue
    g.fill(x, y, w, h, MOON.rockDark);
    for (let py = y + 2; py < y + h - 2; py++) {
      for (let px = x + 2; px < x + w - 2; px++) {
        const hb = hash(px >> 1, py >> 1) % 16;
        g.pset(px, py, hb < 4 ? MOON.rockLight : hb < 6 ? MOON.rockDark : MOON.rock);
      }
    }
    g.rect(x, y, w, h, ink);
    g.rect(x + 3, y + 3, w - 6, h - 6, MOON.stoneDark);
    g.fill(x + 6, y + 6, w - 12, h - 12, [10, 14, 52]);
    for (const [rx, ry] of [[x + 3, y + 3], [x + w - 5, y + 3], [x + 3, y + h - 5], [x + w - 5, y + h - 5]]) g.fill(rx, ry, 2, 2, MOON.stone); // rivets
    for (let i = 0; i < 26; i++) {
      const sx = x + 8 + (hash(i, 3) % (w - 16));
      const sy = y + 8 + (hash(i, 8) % (h - 16));
      g.pset(sx, sy, i % 3 ? [255, 255, 255] : [150, 160, 220]);
    }
    if (this.blink(4)) {
      g.text('SECRET LEVEL', cx + 1, y + 13, ink, 3, 'center');
      g.text('SECRET LEVEL', cx, y + 12, BANNER_TEXT, 3, 'center');
      g.text(screen.first ? 'UNLOCKED!' : 'AHEAD!', cx + 1, y + 39, ink, 2, 'center');
      g.text(screen.first ? 'UNLOCKED!' : 'AHEAD!', cx, y + 38, [150, 200, 255], 2, 'center');
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
    this.drawBonus(scr, y);
    g.text(`RUN TOTAL ${pad(scr.score)}`, cx, y + 30, red, 1, 'center');
    g.text('ENTER YOUR NAME', cx, y + 42, red, 1, 'center');
    // The letters, centred, with OK centred under them.
    const left = cx - Math.round((INITIALS * 26 - 6) / 2);
    for (let i = 0; i < INITIALS; i++) {
      const lx = left + i * 26;
      this.button(`up${i}`, '+', lx, y + 54, 20, true);
      if (i !== scr.pos || this.blink(2)) g.text(scr.letters[i], lx + 10, y + 73, red, 2, 'center');
      if (i === scr.pos) g.line(lx + 2, y + 89, lx + 17, y + 89, red);
      this.button(`dn${i}`, '-', lx, y + 92, 20, true);
    }
    this.button('ok', 'OK', cx - 24, y + 114, 48, true);
  }

  drawScores(scr, list) {
    const g = this.g;
    const cx = RES.W / 2;
    const { y } = this.panel(scr.title || 'HIGH SCORES');
    this.drawBonus(scr, y);
    if (scr.score != null) g.text(`YOUR RUN: ${pad(scr.score)}`, cx, y + 30, red, 1, 'center');
    if (list.length) this.drawTable(list, y + 46, scr.highlight, 12);
    else g.text('NO SCORES YET', cx, y + 60, red, 1, 'center');
    // Beat the game: start over from level 1 with a fresh total. In the iOS
    // app (signed in to Game Center) a GAME CENTER button sits beside it.
    if (scr.t <= 0.6) return;
    if (this.gameCenter) {
      this.button('again', scr.next || 'REPLAY', cx - 76, y + 114, 64, true);
      this.button('gc', 'GAME CENTER', cx - 4, y + 114, 80, true);
    } else {
      this.button('again', scr.next || 'REPLAY', cx - 40, y + 114, 80, true);
    }
  }

  // Pick a stage: one button each, locked ones greyed out until the stage
  // before has been finished.
  drawSelect(scr) {
    const cx = RES.W / 2;
    const { y } = this.panel('STAGES');
    const tight = scr.stages.length > 5; // six or more buttons: pack them closer
    scr.stages.forEach((st, i) => {
      const open = i < scr.unlocked;
      this.button(`stage${i}`, open ? st.name.toUpperCase() : 'LOCKED', cx - 45, y + (tight ? 28 + i * 16 : 32 + i * 20), 90, open);
    });
    // Opened from a stage's start or bail screen: a way back to it.
    if (scr.back) this.button('back', 'BACK', 61, 43, 40, true);
  }

  // Above the end-of-run panel: the no-bail bonus, when earned (already in the total).
  drawBonus(scr, panelY) {
    if (!this.blink(2)) return;
    const cx = RES.W / 2;
    const lines = [scr.note, scr.bonus ? `NO BAIL BONUS +${scr.bonus}` : null].filter(Boolean);
    lines.forEach((text, i) => {
      this.g.text(text, cx + 1, panelY - 11 - i * 10, ink, 1, 'center');
      this.g.text(text, cx, panelY - 12 - i * 10, red, 1, 'center');
    });
  }

  // A press inside a button wins; otherwise the nearest button within a
  // finger's slack (buttons sit close together on the name entry).
  hitButton(lx, ly) {
    const padding = 12;
    const dist = (b) => Math.hypot(Math.max(b.x - lx, 0, lx - b.x - b.w), Math.max(b.y - ly, 0, ly - b.y - b.h));
    let best = null;
    for (const b of this.buttons) if (dist(b) <= padding && (!best || dist(b) < dist(best))) best = b;
    return best?.id;
  }
}

// Shortens text that would be wider than `max` pixels.
function fit(g, text, max) {
  if (g.textWidth(text) <= max) return text;
  let t = text;
  while (t.length > 1 && g.textWidth(`${t}...`) > max) t = t.slice(0, -1);
  return `${t}...`;
}
