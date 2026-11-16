// Shared tuning constants. Everything is in logical pixels (the game is drawn
// on a fixed 960x540 stage that gets scaled to fit the device).

export const WORLD = Object.freeze({
  W: 960,
  H: 540,
  GROUND: 450, // y of the ground line (y grows downward)
});

export const PHYS = Object.freeze({
  ROLL_SPEED: 300, // px/s while rolling and in the air
  GRIND_SPEED: 285, // px/s while grinding (a little friction)
  GRAVITY: 2400, // px/s^2
  OLLIE_V: 900, // take-off speed of an ollie from the ground
  POP_V: 780, // take-off speed when popping out of a grind
  CHARGE_MIN: 0.12, // a hold shorter than this (s) is a plain ollie
  CHARGE_TIME: 0.6, // further seconds of holding to reach the highest ollie
  CHARGE_BOOST: 0.35, // a full charge pops this much faster (0.35 -> about 1.8x as high)
  GRIND_WINDOW: 0.2, // a tap locks a grind only this many seconds (or fewer) before touching the rail
  NOSE: 18, // distance from the feet to the board's nose (used for collisions)
  START_X: 80, // where the skater waits before the run
  QP_AIR_TIME: 1.15, // seconds in the air off a quarter pipe: straight up and back down at riding speed
  BAIL_RETRY_DELAY: 0.7, // seconds before a tap restarts after a bail
});

// The shared high-score table (Supabase). Both values are public: the anon key
// can only read and add scores (row level security, see the setup SQL). Empty
// means the table stays on the device.
export const SCOREBOARD = Object.freeze({
  url: 'https://meyzelyllboyuypnmusr.supabase.co',
  key: 'sb_publishable_NHTCq8t75Xnp6NMI9pHLHQ_8A_w50kV',
});

export const SCORE = Object.freeze({
  GRIND_PER_PX: 1, // grind points per pixel travelled on the rail
});

// Grinds. A timed tap locks a 50-50. Holding the finger down as you reach the
// rail also locks one, and dragging while holding picks the grind: forward
// (right) puts the weight on the nose, back (left) on the back truck.
//   pitch: board tilt while grinding (radians, + = nose down)
export const GRINDS = Object.freeze({
  '50-50': { name: '50-50 GRIND', base: 100, pitch: 0 },
  '5-0': { name: '5-0 GRIND', base: 150, pitch: -0.22 },
  nose: { name: 'NOSE GRIND', base: 200, pitch: 0.22 },
});

// Air tricks. The key is the input that triggers it: a tap, a one-direction
// swipe, or a two-direction swipe pattern ("down-right" = swipe down, then
// right without lifting). Screen directions; the skater rides to the right.
//   board: how the board moves  -> flip (around its long axis), flipRev (heelflip),
//          shove (spins flat), treflip (flip + flat 360), hardflip (flip + flat 180)
//   body:  'spin' turns the rider (and board) a full 360,
//          'backflip' rotates them a full 360 backwards, head over heels
export const TRICKS = Object.freeze({
  tap: { name: 'KICKFLIP', dur: 0.44, points: 150, board: 'flip' },
  down: { name: 'HEELFLIP', dur: 0.44, points: 150, board: 'flipRev' },
  up: { name: 'POP SHOVE-IT', dur: 0.37, points: 100, board: 'shove' },
  right: { name: 'FS 360', dur: 0.52, points: 200, body: 'spin', dirSign: 1 },
  left: { name: 'BS 360', dur: 0.52, points: 200, body: 'spin', dirSign: -1 },
  'down-right': { name: '360 FLIP', dur: 0.575, points: 300, board: 'treflip' },
  'down-left': { name: 'HARDFLIP', dur: 0.52, points: 250, board: 'hardflip' },
  // A counter-clockwise circle. Slow, so it needs big air: the quarter pipe
  // or the secret level. Land before it comes round and you bail.
  circle: { name: 'BACKFLIP', dur: 0.85, points: 1000, body: 'backflip' },
});
