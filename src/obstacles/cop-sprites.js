// Pixel-grid sprites for the cop car and the cop. One character is one game pixel;
// '.' is clear and the letters index SPRITE_PALETTE. (Our own drawing, laid out by hand
// and outlined in black, in the same chunky shaded style as the rest of the game.)
export const SPRITE_PALETTE = {
  k: [0, 0, 0],
  w: [250, 250, 252],
  l: [212, 222, 232],
  g: [160, 172, 192],
  d: [64, 70, 86],
  D: [30, 30, 38],
  b: [150, 205, 240],
  B: [96, 150, 205],
  y: [255, 232, 150],
  o: [255, 150, 40],
  s: [168, 174, 186],
  S: [226, 230, 238],
  G: [255, 205, 70],
  t: [54, 54, 62],
  n: [40, 70, 150],
  N: [24, 40, 100],
  f: [255, 212, 165],
};

// The car, head-on, 44 x 32: the roof is row 0 and the street is the last row.
export const CAR_SPRITE = [
  ".........kkkkkkkkkkkkkkkkkkkkkkkkkk.........",
  "........kllwSSSSSSSSSSSSSSSSSSSSwggk........",
  "........kllwwwwwwwwwwwwwwwwwwwwwwggk........",
  "........klldbwbbbbbwbddbbbbbbbbbdggk........",
  ".......klldbbbwbbbbbwddbbbbbbbbbbdggk.......",
  ".......klldbbbbwbbbbbwbbbbbbbbbbbdggk.......",
  ".......klldBBBBBwBBBBBBBBBBBBBBBBdggk.......",
  "......klldBBBBBBBBBBBBBBBBBBBBBBBBdggk......",
  "......klldBBBBBBBBBBBBBBBBBBBBBBBBdggk......",
  "...kkkllddddddddddddddddddddddddddddggkkk...",
  "..klSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSgk..",
  ".klwwwwwwwwwwwwwwwwwwwGwwwwwwwwwwwwwwwwwwgk.",
  ".klwwwwwwwwwwwwwwwwwwGGGwwwwwwwllllllllllgk.",
  ".klwwwwwwwwwwwwwwwwwwwGwwwwwwwwllllllllllgk.",
  ".klllllllllllllllllllllllllllllllllllllllgk.",
  "klwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwgk",
  "kllkkkkkkkkllllllllllllllllllllllkkkkkkkkllk",
  "kDDkywwwwykDDkkkkkkkkkkkkkkkkkkDDkywwwwykDDk",
  "kDDkywwwwykDDksdsdsdsdsdsdsdsdkDDkywwwwykDDk",
  "kDDkywwwwykDDksdsdsdsdsdsdsdsdkDDkywwwwykDDk",
  "kDDkooyyyykDDksdsdsdsdsdsdsdsdkDDkyyyyookDDk",
  "kDDkkkkkkkkDDksdsdsdsdsdsdsdsdkDDkkkkkkkkDDk",
  "kDDDDDDDDDDDDkkkkkkkkkkkkkkkkkkDDDDDDDDDDDDk",
  "kDDDsSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSsDDDk",
  "kDDDDDDDDDDDDDDDDDDkkkkkkkDDDDDDDDDDDDDDDDDk",
  ".kDtttttttDDDDDDDDDkgggggkDDDDDDDDtttttttDk.",
  ".kDtdtttttDDDDDDDDDkkkkkkkDDDDDDDDtdtttttDk.",
  "..ktdtttttddddddddddddddddddddddddtdtttttk..",
  "..ktdsssttkkkkkkkkkkkkkkkkkkkkkkkktdsssttk..",
  "..ktdsssttk......................ktdsssttk..",
  "..ktttttttk......................ktttttttk..",
  "...kkkkkkk........................kkkkkkk..."
];

// The cop, 11 x 17, facing right: tumbling out of the door, then running.
export const COP_SPRITES = {
  jump: [
  "...kkkkk...",
  ".kkNNNNNkkk",
  "kfNNNGNNNNf",
  "knkfffffknk",
  "knkffffkknk",
  "knkfffffknk",
  ".knnnnnnnk.",
  "..knnnGnk..",
  "..knnnnnk..",
  "..knnnnnk..",
  "..kNNNNNk..",
  "...knknk...",
  "...knknk...",
  "..knk.knkk.",
  ".knk...knNk",
  "kNnk...kNk.",
  ".kNk....k.."
],
  runA: [
  "...kkkkk...",
  "..kNNNNNkk.",
  ".kNNNGNNNNk",
  "..kfffffkk.",
  "..kffffkk..",
  "..kfffffk..",
  "..knnnnnnk.",
  ".knnnnGnknk",
  "knknnnnnknk",
  "nkknnnnnkfk",
  "fkkNNNNNkk.",
  "k..knknk...",
  "..knk.knk..",
  ".knk...knk.",
  "knk....knk.",
  "NNk....kNNk",
  "kk......kk."
],
  runB: [
  "...kkkkk...",
  "..kNNNNNkk.",
  ".kNNNGNNNNk",
  "kfkfffffkk.",
  "knkffffkk..",
  "knkfffffk..",
  ".knnnnnnk..",
  "..knnnGnnk.",
  "..knnnnnknk",
  "..knnnnnknk",
  "..kNNNNNkfk",
  "...knknk.k.",
  "...knkknk..",
  "...knkknk..",
  "...knknk...",
  "..kNNkNNk..",
  "...kk.kk..."
],
};

export function blit(g, rows, x, y) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch !== '.') g.pset(x + c, y + r, SPRITE_PALETTE[ch]);
    }
  }
}
