// A tiny retro framebuffer: a 320x180 grid of pixels. Everything is plotted
// pixel by pixel (Bresenham lines, midpoint circles, a 5x7 bitmap font), so
// there's no anti-aliasing at all. Each stage has its own palette (below): a
// sky, a stacked pixel-art ground, a black rider with a brown (wood) board and
// white wheels, and red for all text.
// Street furniture (the trash can, construction cones and barriers) is shaded pixel art in grey, silver and black.

export const RES = { W: 320, H: 180 };

export const PAL = {
  sky: [110, 180, 255], // bright blue
  ink: [0, 0, 0],
  red: [170, 0, 0], // dark red text so it reads on the sky
  ground: [64, 64, 64], // asphalt
  crack: [40, 40, 40],
  fleck: [96, 96, 96],
  kerb: [88, 88, 88],
  grass: [48, 112, 44], // thin grass layer: base, light blades, dark blades
  blade: [92, 154, 62],
  shade: [30, 78, 34],
  dirt: [74, 52, 34], // chunky dirt below it: muted browns and a few grey stones
  dirtLight: [96, 68, 44],
  dirtDark: [52, 36, 24],
  stone: [112, 112, 118],
  stoneDark: [72, 72, 80],
  edge: [128, 0, 0],
  deck: [170, 85, 0],
  wheel: [255, 255, 255],
  fire: [255, 255, 85],
  flame: [255, 85, 85],
  steel: [128, 128, 128],
  shine: [192, 192, 192],
  orange: [255, 128, 0],
  far: [110, 180, 255], // Stage 3's faint skyline, far and near layers (same as the sky elsewhere)
  near: [110, 180, 255],
  window: [110, 180, 255],
};

// Palettes are the base PAL with a few colours swapped. The secret level (the
// Mega Ramp) is on the moon: a navy sky and light red text. `red` is the text colour's name everywhere, whatever colour it is.
// The skate park (Stage 5) has a sunset sky and a dusk skyline with lit windows.
// The playground (Stage 4) has a bright blue sky and a red rubber-mat surface.
// The construction site (Stage 3) has a light grey sky with a faint skyline,
// and darker red text so it reads on grey; its surface is a light concrete
// sidewalk (the other stages ride on dark asphalt).
const BASE = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, [...v]]));
const PALETTES = {
  normal: BASE,
  secret: { ...BASE, sky: [16, 24, 88], red: [255, 96, 96], fire: [255, 255, 0], flame: [255, 0, 0] },
  play: { ...BASE, sky: [110, 180, 255], red: [170, 0, 0], ground: [150, 70, 70], kerb: [190, 100, 100], crack: [110, 40, 40], fleck: [210, 130, 130], far: [110, 180, 255], near: [110, 180, 255], window: [110, 180, 255] },
  park: { ...BASE, sky: [236, 140, 92], red: [128, 0, 0], ground: [150, 140, 140], kerb: [180, 170, 170], crack: [110, 100, 104], fleck: [200, 190, 190], far: [216, 120, 100], near: [190, 100, 100], window: [250, 190, 110] },
  // Hellride: a blood-orange sky (bands and mountains are painted over it), light ember-red text (the sky is dark at the top), black basalt ground
  // with a smoulder in the cracks, scorched "grass" and maroon rock.
  hell: { ...BASE, sky: [214, 68, 40], red: [255, 170, 130], ground: [58, 40, 48], kerb: [92, 62, 70], crack: [30, 16, 24], fleck: [226, 96, 36], grass: [96, 30, 22], blade: [160, 52, 24], shade: [52, 16, 16], dirt: [66, 26, 30], dirtLight: [96, 38, 34], dirtDark: [38, 14, 20], stone: [132, 70, 50], stoneDark: [80, 36, 34] },
  // Frostbite: a pale blue winter sky, white snow for a surface (blue-grey shadow flecks), an icy
  // layer under it, then frozen blue-slate earth. Dark red text reads on the pale sky.
  frost: { ...BASE, sky: [182, 208, 242], red: [150, 0, 28], ground: [238, 244, 252], kerb: [150, 176, 214], crack: [118, 146, 196], fleck: [255, 255, 255], grass: [150, 196, 230], blade: [196, 228, 250], shade: [96, 140, 190], dirt: [72, 86, 116], dirtLight: [98, 114, 150], dirtDark: [48, 58, 84], stone: [154, 170, 194], stoneDark: [98, 110, 134] },
  // Boardwalk: a bright seaside sky, wooden planks for a surface, pale sand for the "grass" layer and
  // sandy earth under it. Dark red text reads on the sky.
  beach: { ...BASE, sky: [118, 200, 255], red: [170, 0, 20], ground: [206, 152, 96], kerb: [232, 184, 128], crack: [150, 100, 58], fleck: [226, 178, 120], grass: [236, 214, 150], blade: [252, 238, 186], shade: [204, 176, 112], dirt: [188, 150, 98], dirtLight: [212, 178, 124], dirtDark: [146, 112, 70], stone: [238, 228, 204], stoneDark: [176, 156, 118] },
  // Junkyard: a hazy dust-brown sky, packed grey-brown dirt and gravel for a surface, oily olive scrub for
  // the "grass" layer, rusty earth under it. Dark red text reads on the sky.
  junk: { ...BASE, sky: [198, 168, 130], red: [128, 0, 8], ground: [118, 106, 96], kerb: [150, 136, 122], crack: [80, 70, 62], fleck: [150, 136, 120], grass: [96, 98, 50], blade: [150, 142, 64], shade: [64, 64, 36], dirt: [118, 72, 46], dirtLight: [146, 94, 58], dirtDark: [80, 48, 32], stone: [150, 150, 158], stoneDark: [92, 92, 102] },
  // Haunted Night: a twilight purple sky (light text, the top is dark), a pale stone path for a surface, sickly
  // green turf for the "grass" layer, dark soil under it with bone-pale stones.
  // Candy Land: a pastel pink sky (dark red text reads on it), pale pink icing for a surface with sugar flecks,
  // minty frosting for the "grass" and chocolate for the earth, with a few white sugar lumps.
  candy: { ...BASE, sky: [255, 200, 224], red: [150, 0, 56], ground: [255, 170, 204], kerb: [255, 214, 232], crack: [214, 96, 150], fleck: [255, 236, 246], grass: [110, 214, 176], blade: [170, 240, 206], shade: [60, 150, 124], dirt: [112, 66, 48], dirtLight: [146, 90, 62], dirtDark: [76, 44, 36], stone: [255, 244, 236], stoneDark: [214, 188, 176] },
  haunt: { ...BASE, sky: [92, 64, 140], red: [255, 150, 170], ground: [112, 102, 130], kerb: [140, 130, 160], crack: [72, 64, 90], fleck: [138, 128, 156], grass: [58, 96, 66], blade: [96, 150, 80], shade: [34, 60, 44], dirt: [74, 52, 60], dirtLight: [98, 70, 76], dirtDark: [46, 32, 40], stone: [190, 184, 170], stoneDark: [120, 114, 104] },
  site: { ...BASE, sky: [224, 224, 224], red: [170, 0, 0], ground: [150, 150, 150], kerb: [178, 178, 178], crack: [118, 118, 118], fleck: [196, 196, 196], far: [208, 210, 218], near: [196, 198, 208], window: [214, 216, 224] },
};

// Switch palettes in place, so code that kept a reference to PAL.sky etc. follows.
export function setPalette(name) {
  const pal = PALETTES[name] || PALETTES.normal;
  for (const k of Object.keys(pal)) PAL[k].splice(0, 3, ...pal[k]);
}

// 5x7 glyphs, one 5-bit row per number (MSB = leftmost pixel).
const b = (...rows) => rows.map((r) => parseInt(r, 2));
const FONT = {
  A: b('01110', '10001', '10001', '11111', '10001', '10001', '10001'),
  B: b('11110', '10001', '10001', '11110', '10001', '10001', '11110'),
  C: b('01110', '10001', '10000', '10000', '10000', '10001', '01110'),
  D: b('11110', '10001', '10001', '10001', '10001', '10001', '11110'),
  E: b('11111', '10000', '10000', '11110', '10000', '10000', '11111'),
  F: b('11111', '10000', '10000', '11110', '10000', '10000', '10000'),
  G: b('01110', '10001', '10000', '10111', '10001', '10001', '01111'),
  H: b('10001', '10001', '10001', '11111', '10001', '10001', '10001'),
  I: b('01110', '00100', '00100', '00100', '00100', '00100', '01110'),
  J: b('00111', '00010', '00010', '00010', '00010', '10010', '01100'),
  K: b('10001', '10010', '10100', '11000', '10100', '10010', '10001'),
  L: b('10000', '10000', '10000', '10000', '10000', '10000', '11111'),
  M: b('10001', '11011', '10101', '10101', '10001', '10001', '10001'),
  N: b('10001', '10001', '11001', '10101', '10011', '10001', '10001'),
  O: b('01110', '10001', '10001', '10001', '10001', '10001', '01110'),
  P: b('11110', '10001', '10001', '11110', '10000', '10000', '10000'),
  Q: b('01110', '10001', '10001', '10001', '10101', '10010', '01101'),
  R: b('11110', '10001', '10001', '11110', '10100', '10010', '10001'),
  S: b('01111', '10000', '10000', '01110', '00001', '00001', '11110'),
  T: b('11111', '00100', '00100', '00100', '00100', '00100', '00100'),
  U: b('10001', '10001', '10001', '10001', '10001', '10001', '01110'),
  V: b('10001', '10001', '10001', '10001', '10001', '01010', '00100'),
  W: b('10001', '10001', '10001', '10101', '10101', '10101', '01010'),
  X: b('10001', '10001', '01010', '00100', '01010', '10001', '10001'),
  Y: b('10001', '10001', '01010', '00100', '00100', '00100', '00100'),
  Z: b('11111', '00001', '00010', '00100', '01000', '10000', '11111'),
  0: b('01110', '10001', '10011', '10101', '11001', '10001', '01110'),
  1: b('00100', '01100', '00100', '00100', '00100', '00100', '01110'),
  2: b('01110', '10001', '00001', '00010', '00100', '01000', '11111'),
  3: b('11111', '00010', '00100', '00010', '00001', '10001', '01110'),
  4: b('00010', '00110', '01010', '10010', '11111', '00010', '00010'),
  5: b('11111', '10000', '11110', '00001', '00001', '10001', '01110'),
  6: b('00110', '01000', '10000', '11110', '10001', '10001', '01110'),
  7: b('11111', '00001', '00010', '00100', '01000', '01000', '01000'),
  8: b('01110', '10001', '10001', '01110', '10001', '10001', '01110'),
  9: b('01110', '10001', '10001', '01111', '00001', '00010', '01100'),
  ' ': b('0', '0', '0', '0', '0', '0', '0'),
  '.': b('0', '0', '0', '0', '0', '01100', '01100'),
  ',': b('0', '0', '0', '0', '01100', '00100', '01000'),
  '!': b('00100', '00100', '00100', '00100', '00100', '0', '00100'),
  '?': b('01110', '10001', '00001', '00010', '00100', '0', '00100'),
  // the interrobang (a question mark and an exclamation mark in one)
  '‽': b('01110', '10001', '10101', '00101', '00100', '0', '00100'),
  ':': b('0', '01100', '01100', '0', '01100', '01100', '0'),
  '-': b('0', '0', '0', '11111', '0', '0', '0'),
  '+': b('0', '00100', '00100', '11111', '00100', '00100', '0'),
  '(': b('00010', '00100', '01000', '01000', '01000', '00100', '00010'),
  ')': b('01000', '00100', '00010', '00010', '00010', '00100', '01000'),
  "'": b('00100', '00100', '01000', '0', '0', '0', '0'),
  '/': b('00001', '00010', '00010', '00100', '01000', '01000', '10000'),
  '*': b('0', '00100', '10101', '01110', '10101', '00100', '0'),
  '[': b('01110', '01000', '01000', '01000', '01000', '01000', '01110'),
  ']': b('01110', '00010', '00010', '00010', '00010', '00010', '01110'),
  '>': b('01000', '00100', '00010', '00001', '00010', '00100', '01000'),
  '<': b('00010', '00100', '01000', '10000', '01000', '00100', '00010'),
  '=': b('0', '0', '11111', '0', '11111', '0', '0'),
};

// The 5x7 bitmap of a character, rows as bit masks (for text that is drawn turned).
export const glyph = (ch) => FONT[ch] || FONT['?'];

export class Pix {
  constructor(ctx, w = RES.W, h = RES.H) {
    this.ctx = ctx;
    this.w = w;
    this.h = h;
    this.img = ctx.createImageData(w, h);
    this.data = this.img.data;
    // Camera offset in pixels, added to everything drawn (scrolling levels).
    this.ox = 0;
    this.oy = 0;
    this.maxY = Infinity;
  }

  clear(c = PAL.sky) {
    const d = this.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = 255;
    }
  }

  flush() {
    this.ctx.putImageData(this.img, 0, 0);
  }

  pset(x, y, c) {
    x = Math.round(x) + this.ox;
    y = Math.round(y) + this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || y > this.maxY) return; // maxY: an optional lowest row (outlines)
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
  }

  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.pset(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  fill(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.pset(x + i, y + j, c);
  }

  rect(x, y, w, h, c) {
    this.line(x, y, x + w - 1, y, c);
    this.line(x, y + h - 1, x + w - 1, y + h - 1, c);
    this.line(x, y, x, y + h - 1, c);
    this.line(x + w - 1, y, x + w - 1, y + h - 1, c);
  }

  circle(cx, cy, r, c, filled = false) {
    cx = Math.round(cx);
    cy = Math.round(cy);
    let x = r;
    let y = 0;
    let err = 1 - r;
    while (x >= y) {
      if (filled) {
        this.line(cx - x, cy + y, cx + x, cy + y, c);
        this.line(cx - x, cy - y, cx + x, cy - y, c);
        this.line(cx - y, cy + x, cx + y, cy + x, c);
        this.line(cx - y, cy - x, cx + y, cy - x, c);
      } else {
        for (const [px, py] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) this.pset(cx + px, cy + py, c);
      }
      y++;
      if (err < 0) err += 2 * y + 1;
      else {
        x--;
        err += 2 * (y - x) + 1;
      }
    }
  }

  textWidth(str, scale = 1) {
    return str.length * 6 * scale - scale;
  }

  // align: 'left' | 'center' | 'right'
  text(str, x, y, c, scale = 1, align = 'left') {
    str = String(str).toUpperCase();
    const w = this.textWidth(str, scale);
    let cx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
    for (const ch of str) {
      const g = FONT[ch] || FONT['?'];
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (g[row] & (1 << (4 - col))) this.fill(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
      cx += 6 * scale;
    }
  }
}
