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
const RAIL_X = 1180; // well past the kicker: on the moon you fly a long way
const RAIL_LEN = 400;
const RAIL_END = RAIL_X + RAIL_LEN; // the deck ends here and the bank starts
const QP_X = 2650;
const QP_R = 210;

// A curved roll-in as a run of short banks following a quarter-circle-ish curve:
// the drop is steepest at the top and flattens out at the bottom.
function rollIn(x, run, y1, y2, n = 20) {
  const out = [];
  let prev = y1;
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const y = y1 + (y2 - y1) * (1 - (1 - u) ** 2);
    out.push(bank({ x: x + (run * (i - 1)) / n, run: run / n, y1: prev, y2: y }));
    prev = y;
  }
  return out;
}

export default {
  id: 'mega-ramp',
  name: 'Mega Ramp',
  secret: true,
  moon: true, // grey cratered rock, and a starry navy sky with Earth and far mountains
  width: QP_X + QP_R + 90,
  speed: 600, // twice normal
  gravity: 0.45, // moon gravity: floaty, long hang time
  qpAirScale: 1.4, // the quarter pipe's big air hangs longer (and goes higher) too
  popScale: 0.65, // softer pops, so the extra hang time doesn't also mean a skyscraper
  endAfterQuarter: true,
  obstacles: [
    bank({ x: -1000, run: 1300, y1: START, y2: START }), // drop-in deck
    ...rollIn(300, 260, START, DECK), // a curved roll-in: steep off the deck, easing out flat
    bank({ x: 560, run: 90, y1: DECK, y2: DECK }), // flat bottom
    bank({ x: 650, run: 150, y1: DECK, y2: LIP }), // kicker
    bank({ x: 800, run: RAIL_END - 800, y1: DECK, y2: DECK }), // rail deck, a long flat run from the kicker
    rail({ x: RAIL_X, length: RAIL_LEN, height: 70, arc: 60, base: DECK }), // rainbow rail
    bank({ x: RAIL_END, run: 700, y1: DECK, y2: G }), // long easy bank down, right off the rail's end
    quarterPipe({ x: QP_X, radius: QP_R }),
  ],
};
