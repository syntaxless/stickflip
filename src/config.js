// Shared tuning constants. Everything is in logical pixels (the game is drawn
// on a fixed 960x540 stage that gets scaled to fit the device).

export const WORLD = Object.freeze({
  W: 960,
  H: 540,
  GROUND: 450, // y of the ground line (y grows downward)
});

export const PHYS = Object.freeze({
  ROLL_SPEED: 250, // px/s while rolling and in the air
  GRIND_SPEED: 235, // px/s while grinding (a little friction)
  GRAVITY: 2400, // px/s^2
  OLLIE_V: 900, // take-off speed of an ollie from the ground
  POP_V: 780, // take-off speed when popping out of a grind
  FLIP_TIME: 0.38, // seconds a kickflip takes to rotate the board
  FLIP_MARGIN: 0.06, // extra time a flip needs before a grind to count as "room for a flip"
  NOSE: 18, // distance from the feet to the board's nose (used for collisions)
  START_X: 80, // where the skater waits before the run
  EXIT_X: 1000, // rolling past this x finishes the level
  BAIL_RETRY_DELAY: 0.7, // seconds before a tap restarts after a bail
});

export const SCORE = Object.freeze({
  KICKFLIP: 150,
  GRIND_BASE: 100,
  GRIND_PER_PX: 1, // grind points per pixel travelled on the rail
});
