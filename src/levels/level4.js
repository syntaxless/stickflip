import { bank, gap } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Level 4: bank to bank. Ride up a bank, ollie off its lip over the gap and
// land on the bank going down the other side. Roll off the lip without an
// ollie and you drop in.
const G = WORLD.GROUND;
const LIP = G - 50;

export default {
  id: 'bank-to-bank',
  name: 'Bank to Bank',
  hint: 'OLLIE OFF THE LIP OF THE BANK. CLEAR THE GAP.',
  obstacles: [
    bank({ x: 250, run: 130, y1: G, y2: LIP }),
    gap({ x: 380, width: 160 }),
    bank({ x: 540, run: 130, y1: LIP, y2: G }),
  ],
  stars: [0, 200, 450],
};
