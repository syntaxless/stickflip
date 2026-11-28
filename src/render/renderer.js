import { WORLD, PHYS } from '../config.js';
import { slopeOf, comboMult, manualWeight } from '../game.js';
import { PAL, RES } from './pixel.js';
import { INITIALS } from '../leaderboard.js';
import { PoseBlender, drawFigure, drawBoard, boardPitch, makeTransform } from './stickman.js';
import { drawSticker, loserSpot } from './sticker.js';
import { drawGumball, CANDY } from '../obstacles/candy.js';
import { squashOf, RAG_SIZE } from '../ragdoll.js';

// Pixel-art renderer. The game world is 960x540 units; it is drawn into a
// 320x180 framebuffer (1 pixel = 3 units), then scaled up with
// nearest-neighbour so every pixel stays chunky.

const S = 3;
// What the rival says on the result screens (the race is decided), or null.
export const rivalWords = (game) => {
  if (!game.rival) return null;
  if (game.phase === 'beaten') return 'YOU LOSE!';
  if (game.phase === 'complete' && game.raceResult?.won) return 'HOW\u203d';
  return null;
};
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
// Frostbite (Stage 7): a pale winter sky (top to horizon), snow-capped mountains and a row of dark pines.
const FROST_BANDS = [[146, 182, 232], [164, 196, 238], [182, 208, 242], [200, 220, 246], [216, 232, 250], [232, 243, 253]];
const FROST = { far: [156, 176, 222], near: [118, 140, 192], cap: [250, 252, 255], pine: [44, 84, 96], pineLit: [78, 122, 128], pineSnow: [236, 244, 252] };
// The stages with a sky of their own (a level flag each; the picture is drawXSky).
const THEMED_SKIES = ['hell', 'frost', 'beach', 'junk', 'haunt', 'candy'];
// Candy Land (Stage 11): a pastel pink-to-blue sky, cotton candy clouds, minty hills, and lollipops and candy canes
// standing on the horizon.
const CANDY_BANDS = [[255, 170, 208], [255, 190, 220], [255, 208, 230], [255, 226, 238], [238, 234, 252], [214, 236, 252]];
// Boardwalk (Stage 8): a bright seaside sky, a strip of sea on the horizon, a pier with a Ferris wheel,
// a row of palms, gulls and a few puffs of cloud.
const BEACH_BANDS = [[70, 160, 250], [96, 180, 255], [126, 200, 255], [158, 218, 255], [190, 232, 255], [220, 244, 255]];
const BEACH = { sea: [34, 130, 214], seaLit: [120, 200, 250], seaFar: [70, 156, 230], wheel: [226, 120, 150], pier: [118, 98, 120], palm: [28, 120, 70], palmLit: [78, 178, 96], trunk: [128, 88, 52], cloud: [255, 255, 255], cloudShade: [214, 232, 250] };
// Junkyard (Stage 9): a hazy dust-brown sky, heaps of scrap standing on the horizon, a crane with a magnet and
// smoke drifting up from a burning pile.
const JUNK_BANDS = [[150, 120, 98], [168, 138, 108], [186, 154, 118], [204, 172, 130], [218, 188, 144], [230, 204, 160]];
const JUNK = { far: [150, 124, 106], near: [112, 92, 82], crane: [92, 74, 66], smoke: [124, 108, 100], smokeLit: [150, 134, 122], rust: [132, 78, 52] };
// Haunted Night (Stage 10): a twilight purple sky (top to horizon), a huge pale moon, stars, a haunted mansion
// on a far hill, dead trees, a row of tombstones, ground mist and bats.
const HAUNT_BANDS = [[44, 30, 92], [62, 40, 110], [84, 52, 128], [112, 66, 140], [146, 86, 150], [182, 110, 158]];
const HAUNT = { hill: [74, 52, 104], hillNear: [54, 38, 82], tree: [38, 26, 60], stone: [64, 50, 92], win: [255, 214, 110], moon: [246, 242, 214], moonShade: [214, 208, 176], moonHalo: [150, 120, 190], mist: [190, 170, 214] };
// Hellride's rival: a pale skeleton with a bare head, red eyes and white Viking horns (no cap).
const RIVAL_LOOK = { color: [238, 232, 214], noCap: true, horns: [255, 255, 255], eyes: true, eyeColor: [255, 30, 30] };
const RIVAL_DECK = [140, 10, 24];
const RIVAL_WHEELS = [238, 232, 214]; // bone wheels, drawn like the player's
// Junkyard's rival is acid green: a vivid toxic yellow-green figure with a plain bare head (no horns, no cap) on a darker green deck.
const JUNK_RIVAL_LOOK = { color: [157, 255, 0], noCap: true, eyes: true };
const JUNK_RIVAL_DECK = [204, 146, 76]; // a wood-coloured board ...
const JUNK_RIVAL_WHEELS = [255, 105, 180]; // ... on pink wheels
const EMBER = [[255, 236, 120], [255, 170, 40], [255, 110, 20]];
const LAVA_BALLS = [[255, 236, 120], [255, 170, 40], [255, 110, 20], [214, 56, 14]];
const SPECIAL_LIFE = 1.3; // seconds a special's banner lives
const LAUGH_FIRST = 1.6; // seconds the rival laughs back the first time he pulls ahead in a run
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
    this.rivalPassed = false;
    this.laughUntil = 0;
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
        case 'stake':
          this.specials.push({ text: 'GOT THE STAKE!', kind: 'item', age: 0 });
          break;
        case 'boss':
          this.sparks(e.x, e.y, 24);
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
    this.time += Math.max(0, dt); // a first frame can report a tiny negative dt; obstacle art indexes colour tables by time % n
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
    for (const o of game.level.obstacles) o.draw(g, { time: this.time, tilt: game.tilt, boom: game.boomAt === null ? null : game.time - game.boomAt, dump: game.dumpAt === null ? null : game.time - game.dumpAt, open: game.openAt === null ? null : game.time - game.openAt, gameTime: game.time, done: game.phase === 'complete' ? game.phaseTime : null, stake: game.stake, boss: { dx: game.bossDx, deadFor: game.bossDeadAt === null ? null : game.time - game.bossDeadAt, blockFor: game.bossBlockAt === null ? null : game.time - game.bossBlockAt } });
    if (game.ball) this.drawChaseBall(g, game);
    if (game.rival) {
      this.trackRival(game);
      this.rivalSay = rivalWords(game);
      this.drawSkater(game.rival.game, g, true, 'rival');
    } // behind the player
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
    // The race is decided: cut to the rival (at the finish line if he won), who says his piece.
    const cut = rivalWords(game) ? game.rival.game.sk : null;
    const s = cut || game.sk;
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

  // The giant gumball chasing the rider (Stage 11): it rolls along the ground, turning as it goes, with a shadow and
  // a puff of sugar dust at its foot. Once the chase is over it slows to a stop.
  drawChaseBall(g, game) {
    const c = game.level.chase;
    const b = game.ball;
    const r = Math.round(c.r / 3);
    const cx = Math.round(b.x / 3);
    const ground = game.groundAt(b.x).y;
    const cy = Math.round(ground / 3) - r;
    for (let dx = -r; dx <= r; dx += 1) g.pset(cx + dx, cy + r, [0, 0, 0]); // contact shadow
    drawGumball(g, cx, cy, r, b.rot);
    if (!b.gone && Math.random() < 0.5) this.particles.push({ kind: 'dust', x: b.x + c.r * 0.3, y: ground, vx: 90 + Math.random() * 120, vy: -60 - Math.random() * 100, life: 0.3 });
  }

  // Whether the rival leads. The first time he pulls ahead in a run he laughs back at the player for
  // LAUGH_FIRST seconds, so it is always seen; after that only the occasional laugh below.
  trackRival(game) {
    // (also while you lie in a bail: that is when he usually pulls ahead, and the laugh is meant to be seen)
    const racing = game.phase === 'playing' || game.phase === 'bailed';
    const ahead = racing && game.rival.game.sk.x > game.sk.x + 30;
    if (game.phase === 'ready') this.rivalPassed = false; // a fresh run
    if (ahead && !this.rivalPassed) {
      this.rivalPassed = true;
      this.laughUntil = this.time + LAUGH_FIRST;
    }
    this.rivalAhead = ahead;
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
    for (const o of game.level.obstacles) o.draw(g, { time: this.time, tilt: game.tilt, boom: game.boomAt === null ? null : game.time - game.boomAt, dump: game.dumpAt === null ? null : game.time - game.dumpAt, open: game.openAt === null ? null : game.time - game.openAt, stake: game.stake, boss: { dx: game.bossDx, deadFor: game.bossDeadAt === null ? null : game.time - game.bossDeadAt, blockFor: game.bossBlockAt === null ? null : game.time - game.bossBlockAt } });
    if (game.rival) {
      this.trackRival(game);
      this.rivalSay = rivalWords(game);
      this.drawSkater(game.rival.game, g, false, 'rival');
    }
    this.drawSkater(game, g, false); // same pose as this frame's game picture
    g.ox = 0;
    g.oy = 0;
  }

  // Stage 3: two faint building layers, slower than the stage. Drawn in screen
  // space, standing on the horizon (it moves with the camera's height).
  drawSkyline(g, game, cam) {
    if (game.level.clouds) this.drawClouds(g, cam);
    const themed = THEMED_SKIES.find((k) => game.level[k]);
    if (!game.level.skyline && !game.level.moon && !themed) return;
    const [ox, oy] = [g.ox, g.oy];
    g.oy = -cam.y;
    const horizon = P(WORLD.GROUND);
    if (themed) {
      // a stage with its own picture behind it: it moves only a little with the camera's height
      g.oy = -Math.round((cam.py ?? cam.y) * 0.3) + (cam.top || 0);
      this[`draw${themed[0].toUpperCase()}${themed.slice(1)}Sky`](g, cam, horizon);
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

  // Frostbite's sky: pale bands deepening upward, a low white sun, two layers of snow-capped
  // mountains, a row of pines, and snow drifting down in two layers (far flakes small and slow).
  drawFrostSky(g, cam, horizon) {
    const shiftOf = (factor) => Math.round((cam.px ?? cam.x) * factor) - (cam.left || 0);
    g.ox = 0;
    const bandH = [22, 24, 22, 20, 18, 14];
    let y = horizon;
    for (let i = FROST_BANDS.length - 1; i >= 0; i--) {
      const h = i === 0 ? 600 : bandH[i];
      g.fill(0, y - h, g.w, h, FROST_BANDS[i]);
      if (i > 0) for (let x = 0; x < g.w; x++) if ((x + i) % 2 === 0) g.pset(x, y - h, FROST_BANDS[i]);
      y -= h;
    }
    g.fill(0, horizon, g.w, 160, FROST_BANDS[FROST_BANDS.length - 1]);
    // the sun: a pale disc low in the sky with a lighter halo ring
    const sx = 70 - shiftOf(0.015);
    const sy = horizon - 70;
    g.circle(sx, sy, 15, [244, 248, 254], true);
    g.circle(sx, sy, 11, [255, 255, 255], true);
    // mountains: a blue body with a white snow cap on the high part (a jagged lower edge)
    for (const [ridge, factor, body, rise, capLine] of [[RIDGE_FAR, 0.06, FROST.far, 34, 66], [RIDGE_NEAR, 0.14, FROST.near, 22, 38]]) {
      const T = ridge.length;
      const s = shiftOf(factor);
      for (let x = 0; x < g.w; x++) {
        const k = (((x + s) % T) + T) % T;
        const h = ridge[k] + rise;
        g.fill(x, horizon - h, 1, h + 60, body);
        const cap = h - capLine + (hash(k >> 1, 3) % 4) - 1;
        if (cap > 0) g.fill(x, horizon - h, 1, Math.min(cap, 22), FROST.cap);
      }
    }
    // pines along the horizon: stacked tiers of triangle, snow on their shoulders, in a repeating row
    const ps = shiftOf(0.3);
    for (let cell = Math.floor(ps / 22) - 1; cell * 22 - ps < g.w + 22; cell++) {
      const h = hash(cell, 61);
      if (h % 4 === 0) continue;
      const tx = cell * 22 - ps + (h % 9);
      const th = 16 + ((h >> 4) % 12);
      for (let row = 0; row < th; row++) {
        const tier = row % 5; // each tier widens, then steps back in
        const w = Math.min(6, 1 + (row >> 2) + (tier >> 1));
        g.fill(tx - w, horizon - th + row, w * 2 + 1, 1, FROST.pine);
        g.pset(tx - w, horizon - th + row, FROST.pineLit);
        if (tier === 0 && row > 0) g.fill(tx - w, horizon - th + row, w * 2 + 1, 1, FROST.pineSnow);
      }
      g.fill(tx - 1, horizon - 1, 2, 3, [60, 44, 40]);
    }
    // snow: far flakes (single pixels, slow) and near flakes (2x2, quicker), drifting down and sideways
    // through the sky's height (190 px above the horizon)
    const t = this.time;
    for (const [n, fall, drift, factor, size] of [[44, 9, 5, 0.1, 1], [26, 22, 12, 0.22, 2]]) {
      const esh = shiftOf(factor);
      const col = 300;
      for (let i = 0; i < n; i++) {
        const h = hash(i, 88 + size);
        const u = (((h % col) + Math.round(t * drift * (0.6 + (h % 5) / 5))) % col + col) % col;
        const v = ((h >> 9) % 190 + Math.round(t * fall * (0.7 + (h % 7) / 7))) % 190;
        const y = horizon - 190 + v;
        for (let tile = Math.floor(esh / col) - 1; tile * col + u - esh < g.w + 2; tile++) {
          const x = tile * col + u - esh;
          if (x < -2) continue;
          g.fill(x, y, size, size, [255, 255, 255]);
        }
      }
    }
  }

  // Boardwalk's sky: bright blue bands paling toward the horizon, a high sun, slow puffs of cloud, a strip of
  // glittering sea with a pier and Ferris wheel standing in it, a row of palms, and gulls gliding across.
  drawBeachSky(g, cam, horizon) {
    const shiftOf = (factor) => Math.round((cam.px ?? cam.x) * factor) - (cam.left || 0);
    g.ox = 0;
    const t = this.time;
    const bandH = [22, 24, 22, 20, 18, 14];
    let y = horizon;
    for (let i = BEACH_BANDS.length - 1; i >= 0; i--) {
      const h = i === 0 ? 600 : bandH[i];
      g.fill(0, y - h, g.w, h, BEACH_BANDS[i]);
      if (i > 0) for (let x = 0; x < g.w; x++) if ((x + i) % 2 === 0) g.pset(x, y - h, BEACH_BANDS[i]);
      y -= h;
    }
    g.fill(0, horizon, g.w, 160, BEACH_BANDS[BEACH_BANDS.length - 1]);
    // the sun: a bright disc with a pale halo, high and left
    const sx = 250 - shiftOf(0.01);
    const sy = horizon - 118;
    g.circle(sx, sy, 17, [200, 232, 255], true);
    g.circle(sx, sy, 13, [255, 246, 190], true);
    g.circle(sx, sy, 10, [255, 255, 235], true);
    // clouds: flat-bottomed puffs drifting slowly (they also creep with time)
    const cs = shiftOf(0.04) + Math.round(t * 2);
    for (let cell = Math.floor(cs / 150) - 1; cell * 150 - cs < g.w + 150; cell++) {
      const h = hash(cell, 71);
      if (h % 3 === 0) continue;
      const cx = cell * 150 - cs + (h % 60);
      const cy = horizon - 70 - ((h >> 5) % 60);
      for (const [dx, dy, r] of [[0, 0, 7], [9, -3, 9], [20, 0, 7], [-9, 2, 5]]) g.circle(cx + dx, cy + dy, r, BEACH.cloud, true);
      g.fill(cx - 14, cy + 6, 40, 3, BEACH.cloudShade);
      g.fill(cx - 14, cy + 9, 40, 4, BEACH_BANDS[3]);
    }
    // the sea: a band of deeper blue meeting the sky, glitter on it, slower than the street
    const seaTop = horizon - 22;
    g.fill(0, seaTop, g.w, 24, BEACH.seaFar);
    g.fill(0, seaTop + 8, g.w, 16, BEACH.sea);
    const ss = shiftOf(0.08);
    for (let x = 0; x < g.w; x++) {
      const wx = x + ss;
      const w = hash(wx >> 1, 9) % 14;
      if (w === 0) g.pset(x, seaTop + 3 + (hash(wx, 4) % 6) + Math.round(Math.sin(t * 2 + wx)), BEACH.seaLit);
      if (w === 1) g.pset(x, seaTop + 12 + (hash(wx, 6) % 8), BEACH.seaLit);
    }
    g.fill(0, seaTop - 1, g.w, 1, [170, 214, 248]);
    // a pier and a Ferris wheel standing in the sea, far away and faint
    const ps = shiftOf(0.12);
    for (let cell = Math.floor(ps / 420) - 1; cell * 420 - ps < g.w + 120; cell++) {
      const px = cell * 420 - ps + 90 + (hash(cell, 3) % 60);
      g.fill(px - 30, seaTop + 6, 90, 3, BEACH.pier); // the deck
      for (let k = 0; k < 90; k += 9) g.fill(px - 30 + k, seaTop + 9, 2, 8, BEACH.pier); // piles
      const wy = seaTop - 22;
      g.circle(px + 12, wy, 19, BEACH.wheel);
      g.circle(px + 12, wy, 18, BEACH.wheel);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + t * 0.15;
        g.line(px + 12, wy, px + 12 + Math.round(Math.cos(a) * 18), wy + Math.round(Math.sin(a) * 18), BEACH.wheel);
        g.fill(px + 11 + Math.round(Math.cos(a) * 18), wy - 1 + Math.round(Math.sin(a) * 18), 3, 3, k % 2 ? [255, 214, 90] : [255, 255, 255]);
      }
      g.line(px + 12, wy, px + 4, seaTop + 6, BEACH.wheel);
      g.line(px + 12, wy, px + 20, seaTop + 6, BEACH.wheel);
    }
    // palms along the horizon: a leaning trunk and a crown of fronds, in a repeating row
    const ls = shiftOf(0.3);
    for (let cell = Math.floor(ls / 96) - 1; cell * 96 - ls < g.w + 40; cell++) {
      const h = hash(cell, 53);
      if (h % 3 === 0) continue;
      const tx = cell * 96 - ls + (h % 30);
      const th = 26 + ((h >> 4) % 12);
      const lean = ((h >> 8) % 3) - 1;
      for (let row = 0; row < th; row++) g.fill(tx + Math.round((row * lean) / 6) - (row < 3 ? 1 : 0), horizon - row, row < 3 ? 3 : 2, 1, BEACH.trunk);
      const hx = tx + Math.round((th * lean) / 6);
      const hy = horizon - th;
      for (let k = 0; k < 7; k++) {
        const a = Math.PI + (k / 6) * Math.PI; // fronds fan up and droop at the tips
        const len = 11 + (k % 2) * 2;
        for (let i = 1; i <= len; i++) {
          const fxp = hx + Math.round(Math.cos(a) * i);
          const fyp = hy + Math.round(Math.sin(a) * i * 0.6 + (i * i) / (len * 2.4));
          g.pset(fxp, fyp, BEACH.palm);
          g.pset(fxp, fyp - 1, i % 3 ? BEACH.palm : BEACH.palmLit);
        }
      }
      g.fill(hx - 1, hy, 3, 2, [96, 62, 34]); // coconuts
    }
    // gulls: little white Vs gliding across, wings flapping
    const gs = shiftOf(0.18);
    for (let i = 0; i < 4; i++) {
      const h = hash(i, 19);
      const gx = ((((h % 500) + Math.round(t * (8 + (h % 6)))) % 500) + 500) % 500;
      const gy = horizon - 90 - ((h >> 8) % 60) + Math.round(Math.sin(t * 0.8 + i) * 3);
      const flap = Math.floor(t * 4 + i) % 2;
      for (let tile = Math.floor(gs / 500) - 1; tile * 500 + gx - gs < g.w + 8; tile++) {
        const x = tile * 500 + gx - gs;
        if (x < -8) continue;
        g.pset(x, gy, [255, 255, 255]);
        g.pset(x - 1, gy - flap, [255, 255, 255]);
        g.pset(x - 2, gy - 1 - flap, [255, 255, 255]);
        g.pset(x + 1, gy - flap, [255, 255, 255]);
        g.pset(x + 2, gy - 1 - flap, [255, 255, 255]);
      }
    }
  }

  // Junkyard's sky: dusty bands, a pale hazy sun, two layers of scrap heaps (cars and tyres sticking out of
  // them), a crane with a magnet hanging from its arm, and smoke curling up from a far fire. Crows wheel about.
  drawJunkSky(g, cam, horizon) {
    const shiftOf = (factor) => Math.round((cam.px ?? cam.x) * factor) - (cam.left || 0);
    g.ox = 0;
    const t = this.time;
    const bandH = [22, 24, 22, 20, 18, 14];
    let y = horizon;
    for (let i = JUNK_BANDS.length - 1; i >= 0; i--) {
      const h = i === 0 ? 600 : bandH[i];
      g.fill(0, y - h, g.w, h, JUNK_BANDS[i]);
      if (i > 0) for (let x = 0; x < g.w; x++) if ((x + i) % 2 === 0) g.pset(x, y - h, JUNK_BANDS[i]);
      y -= h;
    }
    g.fill(0, horizon, g.w, 160, JUNK_BANDS[JUNK_BANDS.length - 1]);
    const sx = 240 - shiftOf(0.01);
    g.circle(sx, horizon - 100, 15, [236, 214, 176], true);
    g.circle(sx, horizon - 100, 11, [250, 236, 200], true);
    // a crane: a lattice mast with an arm out to one side, a cable and a magnet; far away, in the haze
    const cs = shiftOf(0.07);
    for (let cell = Math.floor(cs / 460) - 1; cell * 460 - cs < g.w + 80; cell++) {
      const cx = cell * 460 - cs + 120 + (hash(cell, 5) % 60);
      for (let py = 0; py < 70; py++) {
        g.pset(cx, horizon - py, JUNK.crane);
        g.pset(cx + 4, horizon - py, JUNK.crane);
        if (py % 5 === 0) g.line(cx, horizon - py, cx + 4, horizon - py - 5, JUNK.crane);
      }
      g.fill(cx - 36, horizon - 74, 62, 3, JUNK.crane); // the arm
      g.line(cx - 36, horizon - 74, cx + 2, horizon - 84, JUNK.crane);
      const swing = Math.round(Math.sin(t * 0.9 + cell) * 2);
      g.line(cx - 30, horizon - 71, cx - 30 + swing, horizon - 46, JUNK.crane);
      g.fill(cx - 35 + swing, horizon - 46, 11, 5, JUNK.crane); // the magnet
      g.fill(cx - 34 + swing, horizon - 41, 9, 2, JUNK.rust);
    }
    // scrap heaps: two jagged layers, with the odd car body or tyre ring poking out
    for (const [ridge, factor, body, rise] of [[RIDGE_FAR, 0.12, JUNK.far, 12], [RIDGE_NEAR, 0.26, JUNK.near, 8]]) {
      const T = ridge.length;
      const s = shiftOf(factor);
      for (let x = 0; x < g.w; x++) {
        const k = (((x + s) % T) + T) % T;
        const h = ridge[k] + rise;
        g.fill(x, horizon - h, 1, h + 60, body);
        if (hash(k, 7) % 9 === 0) g.pset(x, horizon - h + 1, JUNK.rust);
        if (hash(k >> 2, 13) % 14 === 0 && h > 12) g.pset(x, horizon - h + 3, JUNK_BANDS[2]);
      }
      if (factor > 0.2) {
        // tyre rings poking out of the near heap
        for (let cell = Math.floor(s / 70) - 1; cell * 70 - s < g.w + 10; cell++) {
          const hh = hash(cell, 77);
          if (hh % 3) continue;
          const tx = cell * 70 - s + (hh % 30);
          const k = ((((tx + s) % T) + T) % T);
          const ty = horizon - ridge[k] - rise + 3;
          g.circle(tx, ty, 3, [30, 30, 36]);
        }
      }
    }
    // smoke: puffs rising and spreading from a smouldering pile, in a repeating tile
    const ss = shiftOf(0.2);
    const col = 520;
    for (let i = 0; i < 4; i++) {
      const h = hash(i, 31);
      const baseX = 60 + (h % 380);
      for (let tile = Math.floor(ss / col) - 1; tile * col + baseX - ss < g.w + 20; tile++) {
        const px0 = tile * col + baseX - ss;
        for (let k = 0; k < 5; k++) {
          const ph = ((t * 0.12 + k / 6 + (h % 50) / 50) % 1);
          const py = horizon - 14 - Math.round(ph * 90);
          const px = px0 + Math.round(Math.sin(ph * 5 + i) * 4) + Math.round(ph * 14);
          const r = 1 + Math.round(ph * 3);
          g.circle(px, py, r, k % 2 ? JUNK.smoke : JUNK.smokeLit, true);
        }
      }
    }
    // crows: little black Vs wheeling about
    const gs = shiftOf(0.16);
    for (let i = 0; i < 3; i++) {
      const h = hash(i, 23);
      const gx = ((((h % 480) + Math.round(t * (6 + (h % 5)))) % 480) + 480) % 480;
      const gy = horizon - 80 - ((h >> 8) % 40) + Math.round(Math.sin(t * 0.7 + i) * 3);
      const flap = Math.floor(t * 3 + i) % 2;
      for (let tile = Math.floor(gs / 480) - 1; tile * 480 + gx - gs < g.w + 8; tile++) {
        const x = tile * 480 + gx - gs;
        if (x < -8) continue;
        for (const [dx, dy] of [[0, 0], [-1, -flap], [-2, -1 - flap], [1, -flap], [2, -1 - flap]]) g.pset(x + dx, gy + dy, [24, 20, 24]);
      }
    }
  }

  // Haunted Night's sky: twilight purple bands, a huge moon with a halo, twinkling stars, a far hill with a haunted
  // mansion (windows flickering), dead trees, a row of tombstones, bats flapping across and mist drifting along
  // the ground.
  drawHauntSky(g, cam, horizon) {
    const shiftOf = (factor) => Math.round((cam.px ?? cam.x) * factor) - (cam.left || 0);
    g.ox = 0;
    const t = this.time;
    const bandH = [22, 24, 22, 20, 18, 14];
    let y = horizon;
    for (let i = HAUNT_BANDS.length - 1; i >= 0; i--) {
      const h = i === 0 ? 600 : bandH[i];
      g.fill(0, y - h, g.w, h, HAUNT_BANDS[i]);
      if (i > 0) for (let x = 0; x < g.w; x++) if ((x + i) % 2 === 0) g.pset(x, y - h, HAUNT_BANDS[i]);
      y -= h;
    }
    g.fill(0, horizon, g.w, 160, HAUNT_BANDS[HAUNT_BANDS.length - 1]);
    // stars: a sprinkle of single pixels that twinkle
    const ss = shiftOf(0.02);
    for (let i = 0; i < 46; i++) {
      const h = hash(i, 91);
      const sx = (((h % 640) - ss) % 640 + 640) % 640;
      const sy = horizon - 150 + ((h >> 9) % 110);
      if (sx < g.w && (Math.floor(t * 2 + i) % 5 !== 0)) g.pset(sx, sy, i % 4 ? [236, 230, 255] : [255, 240, 190]);
    }
    // the moon: a huge pale disc with craters and a violet halo
    const mx = 232 - shiftOf(0.012);
    const my = horizon - 96;
    g.circle(mx, my, 34, HAUNT.moonHalo, true);
    g.circle(mx, my, 30, [196, 162, 214], true);
    g.circle(mx, my, 26, HAUNT.moon, true);
    for (const [dx, dy, r] of [[-9, -8, 5], [8, 4, 6], [-3, 12, 3], [12, -12, 3]]) g.circle(mx + dx, my + dy, r, HAUNT.moonShade, true);
    // a far hill with the mansion on it: towers, a pointed roof, windows that flicker
    const hs = shiftOf(0.05);
    for (let cell = Math.floor(hs / 520) - 1; cell * 520 - hs < g.w + 120; cell++) {
      const hx = cell * 520 - hs + 80;
      for (let i = -70; i <= 70; i++) g.fill(hx + i, horizon - Math.round(34 * Math.max(0, 1 - (i / 80) ** 2)) - 6, 1, 60, HAUNT.hill);
      const by = horizon - 40;
      g.fill(hx - 18, by - 22, 36, 24, HAUNT.tree);
      g.fill(hx - 8, by - 38, 16, 16, HAUNT.tree);
      for (let i = 0; i < 9; i++) g.fill(hx - 5 + i - 0, by - 48 + Math.abs(4 - i), 1, 10 - Math.abs(4 - i), HAUNT.tree);
      g.fill(hx - 22, by - 14, 4, 16, HAUNT.tree);
      g.fill(hx + 18, by - 14, 4, 16, HAUNT.tree);
      const flick = Math.floor(t * 1.5 + cell);
      [[-14, -16], [-6, -16], [4, -16], [12, -16], [-2, -32]].forEach(([wx, wy], i) => { if ((i + flick) % 4) g.fill(hx + wx, by + wy, 2, 3, HAUNT.win); });
    }
    // dead trees: bare trunks with crooked branches, in a repeating row
    const ts = shiftOf(0.14);
    for (let cell = Math.floor(ts / 110) - 1; cell * 110 - ts < g.w + 30; cell++) {
      const h = hash(cell, 33);
      if (h % 3 === 0) continue;
      const tx = cell * 110 - ts + (h % 40);
      const th = 22 + ((h >> 5) % 16);
      g.fill(tx, horizon - th, 2, th, HAUNT.tree);
      for (const [by2, dir] of [[th * 0.7, 1], [th * 0.5, -1], [th * 0.85, -1]]) {
        const len = 6 + ((h >> 3) % 5);
        for (let i = 1; i <= len; i++) g.pset(tx + 1 + dir * i, Math.round(horizon - by2 - i * 0.7), HAUNT.tree);
      }
    }
    // a row of tombstones, nearer
    const gs = shiftOf(0.28);
    for (let cell = Math.floor(gs / 38) - 1; cell * 38 - gs < g.w + 12; cell++) {
      const h = hash(cell, 47);
      if (h % 2 === 0) continue;
      const gx = cell * 38 - gs + (h % 14);
      const gh = 6 + ((h >> 4) % 6);
      g.fill(gx, horizon - gh, 6, gh, HAUNT.stone);
      g.fill(gx + 1, horizon - gh - 1, 4, 1, HAUNT.stone);
      if ((h >> 9) % 3 === 0) { g.fill(gx + 2, horizon - gh - 4, 2, 4, HAUNT.stone); g.fill(gx, horizon - gh - 2, 6, 1, HAUNT.stone); }
    }
    // bats: black Vs flapping across the moon
    const bs = shiftOf(0.2);
    for (let i = 0; i < 5; i++) {
      const h = hash(i, 17);
      const bx = ((((h % 560) + Math.round(t * (14 + (h % 8)))) % 560) + 560) % 560;
      const by2 = horizon - 70 - ((h >> 8) % 70) + Math.round(Math.sin(t * 1.6 + i) * 4);
      const flap = Math.floor(t * 6 + i) % 2;
      for (let tile = Math.floor(bs / 560) - 1; tile * 560 + bx - bs < g.w + 8; tile++) {
        const x = tile * 560 + bx - bs;
        if (x < -8) continue;
        for (const [dx, dy] of [[0, 0], [-1, -flap], [-2, -1 - flap], [-3, -flap], [1, -flap], [2, -1 - flap], [3, -flap]]) g.pset(x + dx, by2 + dy, [18, 12, 28]);
      }
    }
    // ground mist: pale ragged streaks drifting slowly along the horizon
    const ms = shiftOf(0.35);
    for (let row = 0; row < 3; row++) {
      for (let x = 0; x < g.w; x++) {
        const wx = x + ms + Math.round(t * (3 + row * 2));
        const n = hash(Math.floor(wx / 9) + row * 7, 61) % 7;
        if (n < 2) g.pset(x, horizon - 1 - row * 2 - (n % 2), HAUNT.mist);
      }
    }
  }

  // Candy Land's sky: pink deepening to pale blue at the horizon, drifting cotton candy clouds, two rows of minty
  // hills, and big lollipops and candy canes standing along the horizon (slowly scrolling, so they stay behind the rider).
  drawCandySky(g, cam, horizon) {
    const shiftOf = (factor) => Math.round((cam.px ?? cam.x) * factor) - (cam.left || 0);
    g.ox = 0;
    const t = this.time;
    const bandH = [22, 24, 22, 20, 18, 14];
    let y = horizon;
    for (let i = CANDY_BANDS.length - 1; i >= 0; i--) {
      const h = i === 0 ? 600 : bandH[i];
      g.fill(0, y - h, g.w, h, CANDY_BANDS[i]);
      if (i > 0) for (let x = 0; x < g.w; x++) if ((x + i) % 2 === 0) g.pset(x, y - h, CANDY_BANDS[i]);
      y -= h;
    }
    g.fill(0, horizon, g.w, 160, CANDY_BANDS[CANDY_BANDS.length - 1]);
    // cotton candy clouds: lumpy puffs, pink on the underside
    for (let i = 0; i < 7; i++) {
      const cw = 130;
      const cx = (((i * 61 + 14 - shiftOf(0.05) - Math.round(t * 2)) % (cw * 3)) + cw * 3) % (cw * 3) - 30;
      const cy = 20 + (hash(i, 17) % 54);
      for (const [dx, dy, r] of [[0, 0, 7], [9, -3, 9], [20, 0, 7], [-9, 2, 5], [28, 3, 5]]) g.circle(cx + dx, cy + dy, r, [255, 255, 255], true);
      g.fill(cx - 14, cy + 6, 46, 3, [255, 214, 232]);
      g.fill(cx - 12, cy + 9, 42, 2, [255, 176, 212]);
    }
    // far minty hills with sprinkles
    const hs = shiftOf(0.1);
    for (let x = 0; x < g.w; x++) {
      const wx = x + hs;
      const top = horizon - 14 - Math.round(10 * Math.sin(wx / 31) + 6 * Math.sin(wx / 13 + 1));
      g.fill(x, top, 1, horizon - top + 70, [168, 232, 206]);
      g.pset(x, top, [118, 200, 170]);
      if (hash(wx >> 1, 3) % 17 === 0) g.pset(x, top + 4 + (hash(wx, 5) % 6), [255, 150, 190]);
    }
    // lollipops and candy canes: one every so often along the horizon, the nearer layer a little faster
    for (const [factor, cell, tall, salt] of [[0.18, 120, 42, 31], [0.32, 150, 30, 77]]) {
      const sh = shiftOf(factor);
      for (let tile = Math.floor(sh / cell) - 1; tile * cell - sh < g.w + cell; tile++) {
        const h = hash(tile, salt);
        const bx = tile * cell - sh + (h % 40);
        const th = tall + (h >> 5) % 22;
        const kind = (h >> 9) % 3;
        if (kind === 2) {
          // a candy cane: a striped stem with a hook
          for (let i = 0; i < th; i++) {
            const c = Math.floor(i / 4) % 2 ? [255, 255, 255] : [255, 160, 190];
            g.fill(bx, horizon - i, 3, 1, c);
          }
          for (let a = 0; a < 12; a++) {
            const hx = bx + 1 + Math.round(Math.sin((a / 11) * Math.PI) * 6);
            const hy = horizon - th - Math.round(Math.cos((a / 11) * Math.PI) * -4) + 4;
            g.fill(hx - 1, hy - a, 3, 1, a % 4 < 2 ? [255, 255, 255] : [255, 160, 190]);
          }
        } else {
          g.fill(bx, horizon - th, 2, th, [255, 246, 238]);
          const r = 8 + (h >> 13) % 5;
          const cols = kind ? [[168, 208, 255], [255, 255, 255]] : [[255, 170, 204], [255, 255, 255]]; // paler than the obstacles, so they stay behind
          for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            const d = Math.hypot(dx, dy);
            if (d > r) continue;
            const ang = Math.atan2(dy, dx) + d * 0.5;
            g.pset(bx + 1 + dx, horizon - th - r + dy, d > r - 1 ? [214, 150, 190] : Math.sin(ang * 2) > 0 ? cols[0] : cols[1]);
          }
        }
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
  // `who` 'rival' draws the rival's Game (a pale skeleton with white Viking horns on a dark red board).
  drawSkater(game, g = this.g, advance = true, who = null) {
    const s = game.sk;
    const dt = this.frameDt || 1 / 60;
    const junk = who && game.level.junk;
    const look = who ? (junk ? JUNK_RIVAL_LOOK : RIVAL_LOOK) : {};
    const deck = who ? (junk ? JUNK_RIVAL_DECK : RIVAL_DECK) : PAL.deck;
    const wheelColor = junk ? JUNK_RIVAL_WHEELS : who ? RIVAL_WHEELS : PAL.wheel;
    const poseOf = who ? this.rivalPose : this.pose;
    const squash = who ? 0 : this.squash;

    if (s.mode === 'bail' && s.bail) {
      const b = s.bail;
      // the board tumbles end over end on its own
      drawBoard(g, makeTransform(snap(b.bx), b.by, b.bang), 0, 0, deck, !game.level.snowSkate, wheelColor);
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
    drawBoard(g, squashX(base, boardSx), spin, lift, deck, !game.level.snowSkate, wheelColor);
    // Junkyard's and Hellride's rivals: while one leads he now and then looks back over his shoulder and laughs, with a bubble ("HA!" / "FOOL!")
    const laugh = who && (junk || game.level.hell) && (this.rivalSay === 'YOU LOSE!' || (this.rivalAhead && (this.time < this.laughUntil || this.time % 7 > 5.6)));
    drawFigure(g, squashX(base, bodySx), poseOf.pose, laugh ? { ...look, eyes: 'laugh' } : look);
    // Once the race is decided the rival says so: "YOU LOSE!" if he beat you, "HOW‽" if you beat him
    const say = who && this.rivalSay;
    if (laugh || say) {
      const h = base(poseOf.pose.head);
      this.drawBubble(g, say || (junk ? 'HA!' : 'FOOL!'), Math.round(h.x) - 10, Math.round(h.y) - 22);
    }
  }

  // A pixel speech bubble with its tail pointing down at (x + 4, y + 13): white, black outline, black text.
  drawBubble(g, word, x, y) {
    const w = g.textWidth(word) + 4;
    g.fill(x - 1, y - 1, w + 2, 13, PAL.ink);
    g.fill(x, y, w, 11, [255, 255, 255]);
    g.fill(x + 3, y + 11, 2, 2, PAL.ink); // the bubble's tail, pointing at his head
    g.fill(x + 4, y + 11, 1, 1, [255, 255, 255]);
    g.text(word, x + 2, y + 2, PAL.ink);
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
    if (game.stake) this.drawStakeIcon(g, R, 26);
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

  // The wooden stake you are carrying: a small icon with its name, under the speed bar.
  drawStakeIcon(g, right, y) {
    g.text('STAKE', right - 44, y, red, 1, 'right');
    const x = right - 38;
    g.fill(x, y + 2, 25, 3, red);
    g.fill(x + 25, y + 3, 2, 1, red);
    g.fill(x - 2, y + 1, 2, 5, red);
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
        const title = game.rival ? String(game.level.name || 'HELLRIDE').toUpperCase() : 'STICKFLIP';
        g.text(title, cx + 1, 39, ink, 4, 'center');
        g.text(title, cx, 38, red, 4, 'center');
        if (game.rival) g.text('FIRST TO THE FINISH WINS', cx, 70, red, 1, 'center');
        tapY = 80; // no control tips: players find the controls themselves
      }
      if (this.blink()) g.text('TAP TO START', cx, tapY, red, 1, 'center');
    } else if (game.phase === 'beaten') {
      // the rival crossed the line first. The camera has cut to him at the finish gantry on the right,
      // so the words keep to the left of it.
      const bx = game.width > WORLD.W ? 124 : cx;
      g.text('RIVAL WINS!', bx + 1, 39, ink, 3, 'center');
      g.text('RIVAL WINS!', bx, 38, red, 3, 'center');
      g.text('SUCKS TO SUCK', bx, 64, red, 1, 'center');
      const spot = loserSpot(bx);
      drawSticker(g, spot.x, spot.y, 'LOSER', spot.opts);
      if (game.phaseTime >= PHYS.BAIL_RETRY_DELAY && this.blink()) g.text('TAP TO RACE AGAIN', bx, 82, red, 1, 'center');
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
  panel(title, top = 38, height = 136) {
    const g = this.g;
    // The box grows to fit a long title (with a little padding either side); if even the widest box
    // can't hold it at the big size, the title drops to the small size instead of running off.
    const PAD = 10;
    const maxW = RES.W - 8;
    let scale = 2;
    if (g.textWidth(title, 2) + PAD * 2 > maxW) scale = 1;
    const w = Math.min(maxW, Math.max(208, g.textWidth(title, scale) + PAD * 2));
    const x = Math.round((RES.W - w) / 2);
    const y = top;
    const h = height;
    g.fill(x, y, w, h, ink);
    g.rect(x, y, w, h, red);
    g.rect(x + 2, y + 2, w - 4, h - 4, red);
    g.text(title, RES.W / 2, y + (scale === 2 ? 9 : 12), red, scale, 'center');
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
    const n = scr.stages.length;
    const two = n > 7; // eight or more: two columns (an odd last one sits centred at the bottom)
    const tight = n > 5; // six or more buttons: pack them closer
    const { y } = n > 6 ? this.panel('STAGES', 28, 148) : this.panel('STAGES'); // seven or more: the panel is taller
    scr.stages.forEach((st, i) => {
      const open = i < scr.unlocked;
      const label = open ? st.name.toUpperCase() : 'LOCKED';
      if (two) {
        const alone = i === n - 1 && n % 2 === 1;
        const bx = alone ? cx - 45 : cx + (i % 2 ? 4 : -94);
        this.button(`stage${i}`, label, bx, y + 32 + Math.floor(i / 2) * 18, 90, open);
      } else this.button(`stage${i}`, label, cx - 45, y + (tight ? 28 + i * 16 : 32 + i * 20), 90, open);
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
