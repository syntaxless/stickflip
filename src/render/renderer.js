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
// A world position snapped to a whole game pixel. The rider's anchor is drawn
// snapped, so its limbs round the same way every frame instead of shimmering.
const snap = (v) => Math.round(v / S) * S;
const CONC = [190, 190, 196];
const CONC_LIT = [226, 226, 230];
const CONC_DARK = [128, 128, 138];
const GRAVEL = [[150, 148, 144], [176, 170, 158], [124, 120, 116], [188, 168, 130], [160, 156, 150], [138, 130, 118]];
const GRAVEL_LIT = [220, 214, 200];
const GRAVEL_DARK = [84, 80, 76];
const BANNER_TEXT = [255, 214, 120]; // the unlock sign's lettering, whatever the palette
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
    this.particles = [];
    // Pop-up text lives in one fixed slot under the HUD, and a new message
    // replaces the old one instead of piling on top of it. Trick names show in
    // the HUD's combo line; the slot is for the points, banked on landing,
    // when the rider is down on the ground and out of the way.
    this.popups = { bank: null };
    this.specials = []; // banners for gaps and big tricks: { text, kind, age }
    this.squash = 0;
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
        case 'bank':
          this.popup('bank', e.mult > 1 ? `+${e.total} ${e.mult}X COMBO` : `+${e.total}`);
          break;
        case 'special':
          this.specials.push({ text: `${e.name} +${e.points}`, kind: e.kind, age: 0 });
          if (this.specials.length > 3) this.specials.shift();
          break;
        case 'bail': {
          const pool = e.reason === 'gap' && game?.level.obstacles.find((o) => o.splash && e.x >= o.splash.x1 - 20 && e.x <= o.splash.x2 + 20);
          if (pool) this.splash(e.x, pool.splash.y, pool.splash.kind);
          else this.dust(e.x, e.y, 10);
          break;
        }
      }
    }
  }

  // Water, or coloured balls, flung up where the rider fell in.
  splash(x, y, kind = 'water') {
    const balls = kind === 'balls';
    for (let i = 0; i < (balls ? 22 : 28); i++) {
      this.particles.push({
        kind: balls ? 'ball' : 'splash',
        color: balls ? BALL_COLORS[i % BALL_COLORS.length] : null,
        x: x + (Math.random() - 0.5) * (balls ? 70 : 50),
        y: y - 2,
        vx: (Math.random() - 0.5) * (balls ? 260 : 200),
        vy: (balls ? -220 : -150) - Math.random() * 300,
        life: balls ? 1.1 : 0.7,
      });
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
    this.cam = cam; // main.js extends the ground past the game's edges from here
    g.ox = -cam.x;
    g.oy = -cam.y;
    this.drawSkyline(g, game, cam);
    this.drawBackground(game, cam);
    for (const o of game.level.obstacles) o.draw(g, { time: this.time, tilt: game.tilt });
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
    if (game.sk.mode === 'grind' && Math.random() < 0.6) this.sparks(game.sk.x, game.sk.y, 1);
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.kind === 'spark' ? 1400 : p.kind === 'ball' ? 900 : 300) * dt;
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
    for (const o of game.level.obstacles) o.draw(g, { time: this.time, tilt: game.tilt });
    this.drawSkater(game, g, false); // same pose as this frame's game picture
    g.ox = 0;
    g.oy = 0;
  }

  // Stage 3: two faint building layers, slower than the stage. Drawn in screen
  // space, standing on the horizon (it moves with the camera's height).
  drawSkyline(g, game, cam) {
    if (!game.level.skyline) return;
    const [ox, oy] = [g.ox, g.oy];
    g.oy = -cam.y;
    const horizon = P(WORLD.GROUND);
    if (game.level.morning) this.drawMorningSky(g, cam);
    for (const [sky2, factor, colour, windows] of [[SKY_FAR, 0.12, PAL.far, false], [SKY_NEAR, 0.28, PAL.near, true]]) {
      const shift = Math.round(cam.x * factor);
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

  // A morning sky: gold haze lying on the horizon and a low, pale sun that barely
  // moves with the camera. Kept light so the black rider reads against it.
  drawMorningSky(g, cam) {
    const ox = g.ox;
    g.ox = 0;
    const horizon = P(WORLD.GROUND);
    // haze: ten bands of 12 px fading from the sky colour down to pale gold at the horizon
    const [top, low] = [[190, 222, 246], [255, 226, 160]];
    for (let i = 0; i < 10; i++) {
      const k = (i + 1) / 10;
      const c = top.map((v, n) => Math.round(v + (low[n] - v) * k * k));
      g.fill(0, horizon - 120 + i * 12, g.w, 132 - i * 12 + 60, c);
    }
    if (g === this.g) {
      const sx = 250 - Math.round(cam.x * 0.02);
      const sy = horizon - 34;
      const [c1, c2] = [[255, 246, 190], [255, 226, 140]];
      g.fill(sx - 10, sy - 6, 20, 12, c2);
      g.fill(sx - 7, sy - 10, 14, 20, c2);
      g.fill(sx - 8, sy - 8, 16, 16, c2);
      g.fill(sx - 6, sy - 7, 12, 14, c1);
      g.fill(sx - 4, sy - 9, 8, 18, c1);
    }
    g.ox = ox;
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
      if (top < bottom && game.level.wood) {
        this.drawWood(g, x, top, bottom);
      } else if (top < bottom && game.groundAt(x * S + S / 2).material === 'concrete') {
        // a poured concrete slab (a bank, the Euro Gap) down to the street, then the street's own layers
        const base = Math.max(top, G);
        this.drawConcrete(g, x, top, base);
        g.fill(x, base, 1, bottom - base, ink);
        this.drawGround(g, x, base, bottom, !!game.level.sidewalk);
      } else if (top < bottom) {
        g.fill(x, top, 1, bottom - top, ink);
        // raised ground (ramps, banks, stair platforms) is solid earth down to where the street's own dirt ends
        this.drawGround(g, x, top, bottom, !!game.level.sidewalk, ASPHALT_H, GRASS_H, G + ASPHALT_H + GRASS_H + DIRT_H);
      } else if (patches.length) {
        // a dirt-filled gap: a strip sunk a little below the street, no asphalt or grass
        const wx = x * S + S / 2;
        if (patches.some((p) => wx >= p.x1 && wx < p.x2)) {
          g.fill(x, G + 2, 1, bottom - G - 2, ink);
          const gravel = patches.some((p) => wx >= p.x1 && wx < p.x2 && p.kind === 'gravel');
          if (gravel) this.drawGravel(g, x, G + 2, Math.min(bottom, G + DIRT_H + GRASS_H + ASPHALT_H));
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
  drawSkater(game, g = this.g, advance = true) {
    const s = game.sk;
    const dt = this.frameDt || 1 / 60;

    if (s.mode === 'bail' && s.bail) {
      const b = s.bail;
      if (advance) this.pose.update('bail', dt, 10);
      drawBoard(g, makeTransform(snap(b.bx), b.by, b.bang * 0.15), b.bang);
      const onGround = b.y >= game.groundAt(b.x).y - 0.5 && b.vy === 0;
      const ang = onGround ? Math.sign(b.ang || 1) * Math.min(Math.abs(b.ang), Math.PI / 2) : b.ang;
      const hip = this.pose.pose.hip;
      // rotate around the hip, which sits at the bail body position
      const base = makeTransform(snap(b.x), b.y - (onGround ? 12 : 40), ang);
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
    if (advance) this.pose.update(target, dt);

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
    drawBoard(g, squashX(base, boardSx), spin, lift);
    drawFigure(g, squashX(base, bodySx), this.pose.pose);
  }

  drawParticles() {
    for (const p of this.particles) {
      if (p.kind === 'ball') {
        this.g.fill(P(p.x), P(p.y), 2, 2, p.color); // a flung ball: a 2x2 block
        this.g.pset(P(p.x), P(p.y), PAL.wheel);
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
    // A stage's sections are numbered after it: 1-3 is stage 1's third.
    const sec = game.sections.length > 1 ? `-${game.section + 1}` : '';
    g.text(`${game.levelLabel || `LEVEL ${game.levelNumber || 1}`}${sec}: ${game.sectionName}`, L, 4, red);
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
        g.text('STICKFLIP', cx + 1, 39, ink, 4, 'center');
        g.text('STICKFLIP', cx, 38, red, 4, 'center');
        tapY = 80; // no control tips: players find the controls themselves
      }
      if (this.blink()) g.text('TAP TO START', cx, tapY, red, 1, 'center');
      // More than one stage open: a way back to the stage list.
      if (opts.stagesButton) this.button('stages', 'STAGES', cx - 30, 158, 60, true);
    } else if (game.phase === 'bailed') {
      g.text('BAIL!', cx + 1, 39, ink, 3, 'center');
      g.text('BAIL!', cx, 38, red, 3, 'center');
      g.text('SUCKS TO SUCK', cx, 64, red, 1, 'center');
      const ready = game.phaseTime >= PHYS.BAIL_RETRY_DELAY;
      if (ready && this.blink()) g.text('TAP TO TRY AGAIN', cx, 78, red, 1, 'center');
      // Past the first checkpoint, the whole stage can be started over.
      if (ready && game.checkpoint.index > 0) this.button('restart', 'RESTART STAGE', cx - 45, 92, 90, true);
    }
  }

  // The secret level's arrival: a blinking banner over the scene.
  drawUnlock(screen) {
    const g = this.g;
    const cx = RES.W / 2;
    const [x, y, w, h] = [20, 48, 280, 70];
    // a wooden sign: planks with a dark frame, lettering in warm amber
    g.fill(x, y, w, h, WOOD_DARK);
    for (let py = y + 2; py < y + h - 2; py++) {
      const row = Math.floor((py - y) / 6);
      for (let px = x + 2; px < x + w - 2; px++) {
        let c = row % 2 ? WOOD_A : WOOD_B;
        if ((py - y) % 6 === 5 || (px + row * 31) % 70 === 0) c = WOOD_DARK;
        g.pset(px, py, c);
      }
    }
    g.rect(x, y, w, h, ink);
    g.rect(x + 3, y + 3, w - 6, h - 6, WOOD_DARK);
    g.fill(x + 6, y + 6, w - 12, h - 12, [60, 32, 14]);
    if (this.blink(4)) {
      g.text('SECRET LEVEL', cx + 1, y + 13, ink, 3, 'center');
      g.text('SECRET LEVEL', cx, y + 12, BANNER_TEXT, 3, 'center');
      g.text(screen.first ? 'UNLOCKED!' : 'AHEAD!', cx + 1, y + 39, ink, 2, 'center');
      g.text(screen.first ? 'UNLOCKED!' : 'AHEAD!', cx, y + 38, WOOD_LIGHT, 2, 'center');
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
    scr.stages.forEach((st, i) => {
      const open = i < scr.unlocked;
      this.button(`stage${i}`, open ? st.name.toUpperCase() : 'LOCKED', cx - 45, y + 32 + i * 20, 90, open);
    });
  }

  // Above the end-of-run panel: the no-bail bonus, when earned (already in the total).
  drawBonus(scr, panelY) {
    if (!scr.bonus || !this.blink(2)) return;
    const cx = RES.W / 2;
    this.g.text(`NO BAIL BONUS +${scr.bonus}`, cx + 1, panelY - 11, ink, 1, 'center');
    this.g.text(`NO BAIL BONUS +${scr.bonus}`, cx, panelY - 12, red, 1, 'center');
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
