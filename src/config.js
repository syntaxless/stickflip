// Shared tuning constants. Everything is in logical pixels (the game is drawn
// on a fixed 960x540 stage that gets scaled to fit the device).

export const WORLD = Object.freeze({
  W: 960,
  H: 540,
  GROUND: 450, // y of the ground line (y grows downward)
});

export const PHYS = Object.freeze({
  ROLL_SPEED: 330, // px/s while rolling and in the air
  GRIND_SPEED: 313, // px/s while grinding (a little friction)
  GRAVITY: 2400, // px/s^2
  OLLIE_V: 900, // take-off speed of an ollie from the ground
  POP_V: 780, // take-off speed when popping out of a grind
  CHARGE_MIN: 0.12, // a hold shorter than this (s) is a plain ollie
  CHARGE_TIME: 0.6, // further seconds of holding to reach the highest ollie
  CHARGE_BOOST: 0.12, // a full charge pops this much faster (about 1.25x as high): still too
  // little air on flat ground for a backflip
  GRIND_WINDOW: 0.2, // a tap locks a grind only this many seconds (or fewer) before touching the rail
  NOSE: 18, // distance from the feet to the board's nose (used for collisions)
  RIDER_HEIGHT: 60, // feet to the top of the head, for fitting through a ring (a little forgiving)
  START_X: 80, // where the skater waits before the run
  DRAW_CREDIT: 0.6, // time spent drawing a trick shape counts for up to this share of the trick
  QP_SPEED: 1.35, // a quarter pipe speeds the rider up this much, for the rest of the run
  QP_AIR_SPEED: 1.25, // and the air off it goes straight up and down at this times riding speed (sets its height)
  QP_RAMP_BOOST: 1.6, // most a quarter pipe's curve speeds up to keep the riding pace across the screen
  QP_AIR_TIME: 1.15, // seconds in the air off a quarter pipe: straight up and back down at riding speed
  RESTART_DELAY: 0.5, // seconds the rider stands ready after the retry tap, before rolling off (time to lift and tap again, or hold to crouch)
  BAIL_RETRY_DELAY: 0.7, // seconds before a tap restarts after a bail
  // Speed control. The rider rolls on his own at ROLL_SPEED. Holding on the
  // ground charges an ollie (and the crouched push builds a little speed, so a
  // charged ollie carries further); holding and dragging DOWN (for BRAKE_DELAY, so a
  // quick down-flick that is a trick shape doesn't count) brakes. Let go and
  // the speed drifts back to cruising. Dragging forward no longer pushes harder.
  SPEED_MIN: 0.7, // slowest and fastest, as shares of cruising speed
  SPEED_MAX: 1.4,
  HOLD_ACCEL: 120, // px/s^2 while holding (crouched push)
  BRAKE: 420, // px/s^2 while holding and dragging down
  BRAKE_DELAY: 0.2, // s the finger must have been dragging down before it brakes
  SPEED_RETURN: 90, // px/s^2 back toward cruising once you let go
  // Manuals: still holding and dragging back (manual) or forward (nose manual)
  // when you land from an ollie lands you into a manual. Lift to pop out of it.
  MANUAL_DELAY: 0.1, // s the drag must have lasted before landing to count
  MANUAL_MAX: 3, // s: the rider drops the board after this long
  MANUAL_ACCEL: 0.8, // the speed keeps climbing in a manual: this share of cruising speed per second (1.8x after 1 s, 2.6x after 2 s)
  MANUAL_SPEED_MAX: 3, // ...up to this share of cruising speed (reached after 2.5 s)
  // Ollie height follows speed a little (distance follows it a lot): up to
  // this share higher at top speed, lower at the slowest. The total, with the
  // charge, never goes over 1 + CHARGE_BOOST (no backflips on flat ground).
  SPEED_POP_UP: 0.06,
  SPEED_POP_DOWN: 0.1,
  ENTRY_X: -12, // where the rider rolls in from the left on the next screen
});

// The shared high-score table (Supabase). Both values are public: the anon key
// can only read and add scores (row level security, see the setup SQL). Empty
// means the table stays on the device.
export const SCOREBOARD = Object.freeze({
  url: 'https://meyzelyllboyuypnmusr.supabase.co',
  key: 'sb_publishable_NHTCq8t75Xnp6NMI9pHLHQ_8A_w50kV',
});

// A trick (or grind) worth at least this many points is a "special": it gets a
// banner and a jingle, like a named gap bonus does.
export const SPECIAL_POINTS = 300;

export const SCORE = Object.freeze({
  GRIND_PER_PX: 1, // grind points per pixel travelled on the rail
  // Repeating a trick pays less, so variety wins. Each repeat of the same trick
  // in one combo is worth REPEAT_COMBO times the last one (100%, 50%, 25%...);
  // the same trick already banked in the last RUN_WINDOW tricks of the run is
  // worth REPEAT_RUN times as much per earlier time (it recovers as other tricks
  // push it out of the window). Never below REPEAT_MIN of its value. Specials
  // (SPECIAL_POINTS or more) and named gap bonuses are exempt.
  REPEAT_COMBO: 0.5,
  REPEAT_RUN: 0.85,
  REPEAT_MIN: 0.1,
  RUN_WINDOW: 8,
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

// Manuals. Landing from an ollie while holding a drag back (manual) or forward
// (nose manual) rolls on two wheels. The points are added to the running combo
// like a trick (so the multiplier keeps building), by distance rolled.
//   pitch: board tilt (radians, + = nose down)
export const MANUALS = Object.freeze({
  manual: { name: 'MANUAL', base: 50, perPx: 0.4, pitch: -0.3 },
  nose: { name: 'NOSE MANUAL', base: 75, perPx: 0.5, pitch: 0.3 },
});

// Air tricks. The key is what the stroke in the air reads as (see SHAPES in
// gesture.js); a tap in the air is a quick kickflip.
//   roll: the board flips around its long axis (1 = kickflip way, -1 = heelflip way)
//   turn: the board spins flat, in half turns (1 = 180, 2 = 360)
//   body: 'spin' turns the rider (and board) a full 360,
//         'backflip' rotates them a full 360 backwards, head over heels
export const TRICKS = Object.freeze({
  tap: { name: 'KICKFLIP', dur: 0.44, points: 150, roll: 1 },
  kickflip: { name: 'KICKFLIP', dur: 0.44, points: 150, roll: 1 },
  heelflip: { name: 'HEELFLIP', dur: 0.44, points: 150, roll: -1 },
  shove: { name: 'POP SHOVE-IT', dur: 0.37, points: 100, turn: 1 },
  fsShove: { name: 'FS POP SHOVE-IT', dur: 0.37, points: 100, turn: 1 },
  shove360: { name: '360 SHOVE-IT', dur: 0.5, points: 200, turn: 2 },
  fsShove360: { name: 'FS 360 SHOVE-IT', dur: 0.5, points: 200, turn: 2 },
  varialKick: { name: 'VARIAL KICKFLIP', dur: 0.5, points: 250, roll: 1, turn: 1 },
  varialHeel: { name: 'VARIAL HEELFLIP', dur: 0.5, points: 250, roll: -1, turn: 1 },
  hardflip: { name: 'HARDFLIP', dur: 0.52, points: 250, roll: 1, turn: 1 },
  inwardHeel: { name: 'INWARD HEELFLIP', dur: 0.52, points: 250, roll: -1, turn: 1 },
  treflip: { name: '360 FLIP', dur: 0.575, points: 300, roll: 1, turn: 2 },
  laser: { name: 'LASER FLIP', dur: 0.6, points: 350, roll: -1, turn: 2 },
  hardflip360: { name: '360 HARDFLIP', dur: 0.62, points: 400, roll: 1, turn: 2 },
  inward360: { name: '360 INWARD HEEL', dur: 0.62, points: 400, roll: -1, turn: 2 },
  fs360: { name: 'FS 360', dur: 0.52, points: 200, body: 'spin' },
  bs360: { name: 'BS 360', dur: 0.52, points: 200, body: 'spin' },
  // A counter-clockwise circle. Slow, so it needs big air: the quarter pipe
  // or the secret level. Land before it comes round and you bail.
  circle: { name: 'BACKFLIP', dur: 0.85, points: 1000, body: 'backflip' },
});
