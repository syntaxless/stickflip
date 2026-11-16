import { bank, rail, quarterPipe } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Secret level: a mega ramp, side-scrolling (the camera follows the skater).
// Drop in from a high deck, go fast up the kicker and fly onto a deck with a
// raised rail: grind it, or ollie off the kicker to clear it. Roll off the
// deck down a long, easy bank, then finish with a big air out of a tall
// quarter pipe. Unlocked by the third full clear of the six main levels.
const G = WORLD.GROUND; // the street at the bottom
const DECK = G - 300; // the rail deck
const START = G - 500; // the drop-in deck
const LIP = DECK - 100; // top of the kicker
const QP_X = 3100;
const QP_R = 210;

export default {
  id: 'mega-ramp',
  name: 'Mega Ramp',
  hint: 'KICKER, RAIL, THEN THE BIG QUARTER.',
  secret: true,
  width: QP_X + QP_R + 90,
  speed: 750,
  endAfterQuarter: true,
  obstacles: [
    bank({ x: -1000, run: 1300, y1: START, y2: START }), // drop-in deck
    bank({ x: 300, run: 200, y1: START, y2: DECK }), // drop in
    bank({ x: 500, run: 150, y1: DECK, y2: DECK }), // flat bottom
    bank({ x: 650, run: 150, y1: DECK, y2: LIP }), // kicker
    bank({ x: 800, run: 1100, y1: DECK, y2: DECK }), // rail deck
    rail({ x: 830, length: 520, height: 110, base: DECK }),
    bank({ x: 1900, run: 700, y1: DECK, y2: G }), // long easy bank down
    quarterPipe({ x: QP_X, radius: QP_R }),
  ],
  stars: [0, 600, 1500],
};
