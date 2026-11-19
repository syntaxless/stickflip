import { bank, rail, quarterPipe } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Secret level: a mega ramp, side-scrolling (the camera follows the skater).
// Drop in from a high deck and go fast up the kicker at a raised rainbow
// rail. Ollie off the kicker to clear the whole rail and land in the long,
// easy bank just past its end, or grind it and pop off the end into the
// bank. Then finish with a big air out of a tall quarter pipe. Unlocked by a 25,000-point run on any stage (see SECRET_SCORE in main.js). On the moon: grey cratered rock under a navy, starry sky.
const G = WORLD.GROUND; // the street at the bottom
const DECK = G - 300; // the rail deck
const START = G - 500; // the drop-in deck
const LIP = DECK - 100; // top of the kicker
const RAIL_X = 830;
const RAIL_LEN = 500;
const RAIL_END = RAIL_X + RAIL_LEN; // the deck ends here and the bank starts
const QP_X = 2650;
const QP_R = 210;

export default {
  id: 'mega-ramp',
  name: 'Mega Ramp',
  secret: true,
  moon: true, // grey cratered rock, and a starry navy sky with Earth and far mountains
  width: QP_X + QP_R + 90,
  speed: 600, // twice normal
  endAfterQuarter: true,
  obstacles: [
    bank({ x: -1000, run: 1300, y1: START, y2: START }), // drop-in deck
    bank({ x: 300, run: 200, y1: START, y2: DECK }), // drop in
    bank({ x: 500, run: 150, y1: DECK, y2: DECK }), // flat bottom
    bank({ x: 650, run: 150, y1: DECK, y2: LIP }), // kicker
    bank({ x: 800, run: RAIL_END - 800, y1: DECK, y2: DECK }), // rail deck
    rail({ x: RAIL_X, length: RAIL_LEN, height: 70, arc: 60, base: DECK }), // rainbow rail
    bank({ x: RAIL_END, run: 700, y1: DECK, y2: G }), // long easy bank down, right off the rail's end
    quarterPipe({ x: QP_X, radius: QP_R }),
  ],
};
